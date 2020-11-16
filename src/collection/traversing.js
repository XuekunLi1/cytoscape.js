import * as util from '../util';
import * as is from '../is';
import cache from './cache-traversal-call';

/**
 * @class edge
 */
let elesfn = {};

// DAG functions
////////////////

let defineDagExtremity = function( params ){
  return function dagExtremityImpl( selector ){
    let eles = this;
    let ret = [];

    for( let i = 0; i < eles.length; i++ ){
      let ele = eles[ i ];
      if( !ele.isNode() ){
        continue;
      }

      let disqualified = false;
      let edges = ele.connectedEdges();

      for( let j = 0; j < edges.length; j++ ){
        let edge = edges[j];
        let src = edge.source();
        let tgt = edge.target();

        if(
             ( params.noIncomingEdges && tgt === ele && src !== ele )
          || ( params.noOutgoingEdges && src === ele && tgt !== ele )
        ){
          disqualified = true;
          break;
        }
      }

      if( !disqualified ){
        ret.push( ele );
      }
    }

    return this.spawn( ret, { unique: true } ).filter( selector );
  };
};

let defineDagOneHop = function( params ){
  return function( selector ){
    let eles = this;
    let oEles = [];

    for( let i = 0; i < eles.length; i++ ){
      let ele = eles[ i ];

      if( !ele.isNode() ){ continue; }

      let edges = ele.connectedEdges();
      for( let j = 0; j < edges.length; j++ ){
        let edge = edges[ j ];
        let src = edge.source();
        let tgt = edge.target();

        if( params.outgoing && src === ele ){
          oEles.push( edge );
          oEles.push( tgt );
        } else if( params.incoming && tgt === ele ){
          oEles.push( edge );
          oEles.push( src );
        }
      }
    }

    return this.spawn( oEles, { unique: true } ).filter( selector );
  };
};

let defineDagAllHops = function( params ){
  return function( selector ){
    let eles = this;
    let sEles = [];
    let sElesIds = {};

    for( ;; ){
      let next = params.outgoing ? eles.outgoers() : eles.incomers();

      if( next.length === 0 ){ break; } // done if none left

      let newNext = false;
      for( let i = 0; i < next.length; i++ ){
        let n = next[ i ];
        let nid = n.id();

        if( !sElesIds[ nid ] ){
          sElesIds[ nid ] = true;
          sEles.push( n );
          newNext = true;
        }
      }

      if( !newNext ){ break; } // done if touched all outgoers already

      eles = next;
    }

    return this.spawn( sEles, { unique: true } ).filter( selector );
  };
};

elesfn.clearTraversalCache = function( ){
  for( let i = 0; i < this.length; i++ ){
    this[i]._private.traversalCache = null;
  }
};

util.extend( elesfn, {
  // get the root nodes in the DAG
  /**
 * @typedef {object} nodes_roots
 * @property {object} selector - [optional] An optional selector that is used to filter the resultant collection.
 */


  /**
 * From the set of calling nodes, get the nodes which are roots (i.e. no incoming edges, as in a directed acyclic graph).
 * @memberof nodes
 * @param {...nodes_roots} x - Get ID
 * @namespace nodes.roots
 */
  roots: defineDagExtremity({ noIncomingEdges: true }),

  // get the leaf nodes in the DAG
  /**
 * @typedef {object} nodes_leaves
 * @property {object} selector - [optional] An optional selector that is used to filter the resultant collection.
 */


  /**
 * From the set of calling nodes, get the nodes which are leaves (i.e. no outgoing edges, as in a directed acyclic graph).
 * @memberof nodes
 * @param {...nodes_leaves} x - Get ID
 * @namespace nodes.leaves
 */
  leaves: defineDagExtremity({ noOutgoingEdges: true }),

  // normally called children in graph theory
  // these nodes =edges=> outgoing nodes
  /**
 * @typedef {object} nodes_outgoers
 * @property {object} selector - [optional] An optional selector that is used to filter the resultant collection.
 */


  /**
 * Get edges (and their targets) coming out of the nodes in the collection. 
 * @memberof nodes
 * @param {...nodes_outgoers} x - Get ID
 * @namespace nodes.outgoers
 */
  outgoers: cache( defineDagOneHop({ outgoing: true }) , 'outgoers' ),

  // aka DAG descendants
  /**
 * @typedef {object} nodes_successors
 * @property {object} selector - [optional] An optional selector that is used to filter the resultant collection.
 */


  /**
 * Recursively get edges (and their targets) coming out of the nodes in the collection (i.e. the outgoers, the outgoers' outgoers, ...). 
 * @memberof nodes
 * @param {...nodes_successors} x - Get ID
 * @namespace nodes.successors
 */
  successors: defineDagAllHops({ outgoing: true }),

  // normally called parents in graph theory
  // these nodes <=edges= incoming nodes
  /**
 * @typedef {object} nodes_incomers
 * @property {object} selector - [optional] An optional selector that is used to filter the resultant collection.
 */


  /**
 * Get edges (and their sources) coming into the nodes in the collection.
 * @memberof nodes
 * @param {...nodes_incomers} x - Get ID
 * @namespace nodes.incomers
 */
  incomers: cache( defineDagOneHop({ incoming: true }), 'incomers' ),

  // aka DAG ancestors
  /**
 * @typedef {object} nodes_predecessors
 * @property {object} selector - [optional] An optional selector that is used to filter the resultant collection.
 */


/**
 * Recursively get edges (and their sources) coming into the nodes in the collection (i.e. the incomers, the incomers' incomers, ...).
 * @memberof nodes
 * @param {...nodes_predecessors} x - Get ID
 * @namespace nodes.predecessors
 */
  predecessors: defineDagAllHops({ incoming: true })
} );


// Neighbourhood functions
//////////////////////////

util.extend( elesfn, {
  neighborhood: cache(function( selector ){
    let elements = [];
    let nodes = this.nodes();

    for( let i = 0; i < nodes.length; i++ ){ // for all nodes
      let node = nodes[ i ];
      let connectedEdges = node.connectedEdges();

      // for each connected edge, add the edge and the other node
      for( let j = 0; j < connectedEdges.length; j++ ){
        let edge = connectedEdges[ j ];
        let src = edge.source();
        let tgt = edge.target();
        let otherNode = node === src ? tgt : src;

        // need check in case of loop
        if( otherNode.length > 0 ){
          elements.push( otherNode[0] ); // add node 1 hop away
        }

        // add connected edge
        elements.push( edge[0] );
      }

    }

    return ( this.spawn( elements, { unique: true } ) ).filter( selector );
  }, 'neighborhood'),

  closedNeighborhood: function( selector ){
    return this.neighborhood().add( this ).filter( selector );
  },

  openNeighborhood: function( selector ){
    return this.neighborhood( selector );
  }
} );

// aliases
elesfn.neighbourhood = elesfn.neighborhood;
elesfn.closedNeighbourhood = elesfn.closedNeighborhood;
elesfn.openNeighbourhood = elesfn.openNeighborhood;

// Edge functions
/////////////////

util.extend( elesfn, {

  /**
 * @typedef {object} edge_source
 * @property {object} selector - [optional] An optional selector that is used to filter the resultant collection.
 */


/**
 * Get source node of this edge.
 * @memberof edge
 * @param {...edge_source} x - Get ID
 * @namespace edge.source
 */
  source: cache(function sourceImpl( selector ){
    let ele = this[0];
    let src;

    if( ele ){
      src = ele._private.source || ele.cy().collection();
    }

    return src && selector ? src.filter( selector ) : src;
  }, 'source'),

  /**
 * @typedef {object} edge_target
 * @property {object} selector - [optional] An optional selector that is used to filter the resultant collection.
 */


/**
 * Get target node of this edge.
 * @memberof edge
 * @param {...edge_target} x - Get ID
 * @namespace edge.target
 */
  target: cache(function targetImpl( selector ){
    let ele = this[0];
    let tgt;

    if( ele ){
      tgt = ele._private.target || ele.cy().collection();
    }

    return tgt && selector ? tgt.filter( selector ) : tgt;
  }, 'target'),

  /**
 * @typedef {object} edge_sources
 * @property {object} selector - [optional] An optional selector that is used to filter the resultant collection.
 */

/**
 * Get source nodes connected to the edges in the collection.
 * @memberof edge
 * @param {...edge_sources} x - Get ID
 * @namespace edge.sources
 */
  sources: defineSourceFunction( {
    attr: 'source'
  } ),

  /**
 * @typedef {object} edge_targets
 * @property {object} selector - [optional] An optional selector that is used to filter the resultant collection.
 */


/**
 * Get target nodes connected to the edges in the collection.
 * @memberof edge
 * @param {...edge_targets} x - Get ID
 * @namespace edge.targets
 */
  targets: defineSourceFunction( {
    attr: 'target'
  } )
} );

function defineSourceFunction( params ){
  return function sourceImpl( selector ){
    let sources = [];

    for( let i = 0; i < this.length; i++ ){
      let ele = this[ i ];
      let src = ele._private[ params.attr ];

      if( src ){
        sources.push( src );
      }
    }

    return this.spawn( sources, { unique: true } ).filter( selector );
  };
}

util.extend( elesfn, {
  edgesWith: cache( defineEdgesWithFunction(), 'edgesWith' ),

  edgesTo: cache( defineEdgesWithFunction( {
    thisIsSrc: true
  } ), 'edgesTo' )
} );

function defineEdgesWithFunction( params ){

  return function edgesWithImpl( otherNodes ){
    let elements = [];
    let cy = this._private.cy;
    let p = params || {};

    // get elements if a selector is specified
    if( is.string( otherNodes ) ){
      otherNodes = cy.$( otherNodes );
    }

    for( let h = 0; h < otherNodes.length; h++ ){
      let edges = otherNodes[ h ]._private.edges;

      for( let i = 0; i < edges.length; i++ ){
        let edge = edges[ i ];
        let edgeData = edge._private.data;
        let thisToOther = this.hasElementWithId( edgeData.source ) && otherNodes.hasElementWithId( edgeData.target );
        let otherToThis = otherNodes.hasElementWithId( edgeData.source ) && this.hasElementWithId( edgeData.target );
        let edgeConnectsThisAndOther = thisToOther || otherToThis;

        if( !edgeConnectsThisAndOther ){ continue; }

        if( p.thisIsSrc || p.thisIsTgt ){
          if( p.thisIsSrc && !thisToOther ){ continue; }

          if( p.thisIsTgt && !otherToThis ){ continue; }
        }

        elements.push( edge );
      }
    }

    return this.spawn( elements, { unique: true } );
  };
}

util.extend( elesfn, {
  connectedEdges: cache(function( selector ){
    let retEles = [];

    let eles = this;
    for( let i = 0; i < eles.length; i++ ){
      let node = eles[ i ];
      if( !node.isNode() ){ continue; }

      let edges = node._private.edges;

      for( let j = 0; j < edges.length; j++ ){
        let edge = edges[ j ];
        retEles.push( edge );
      }
    }

    return this.spawn( retEles, { unique: true } ).filter( selector );
  }, 'connectedEdges'),

  connectedNodes: cache(function( selector ){
    let retEles = [];

    let eles = this;
    for( let i = 0; i < eles.length; i++ ){
      let edge = eles[ i ];
      if( !edge.isEdge() ){ continue; }

      retEles.push( edge.source()[0] );
      retEles.push( edge.target()[0] );
    }

    return this.spawn( retEles, { unique: true } ).filter( selector );
  }, 'connectedNodes'),

  parallelEdges: cache( defineParallelEdgesFunction(), 'parallelEdges' ),

  codirectedEdges: cache( defineParallelEdgesFunction( {
    codirected: true
  } ), 'codirectedEdges' )
} );

function defineParallelEdgesFunction( params ){
  let defaults = {
    codirected: false
  };
  params = util.extend( {}, defaults, params );

  return function parallelEdgesImpl( selector ){ // micro-optimised for renderer
    let elements = [];
    let edges = this.edges();
    let p = params;

    // look at all the edges in the collection
    for( let i = 0; i < edges.length; i++ ){
      let edge1 = edges[ i ];
      let edge1_p = edge1._private;
      let src1 = edge1_p.source;
      let srcid1 = src1._private.data.id;
      let tgtid1 = edge1_p.data.target;
      let srcEdges1 = src1._private.edges;

      // look at edges connected to the src node of this edge
      for( let j = 0; j < srcEdges1.length; j++ ){
        let edge2 = srcEdges1[ j ];
        let edge2data = edge2._private.data;
        let tgtid2 = edge2data.target;
        let srcid2 = edge2data.source;

        let codirected = tgtid2 === tgtid1 && srcid2 === srcid1;
        let oppdirected = srcid1 === tgtid2 && tgtid1 === srcid2;

        if( (p.codirected && codirected) || (!p.codirected && (codirected || oppdirected)) ){
          elements.push( edge2 );
        }
      }
    }

    return this.spawn( elements, { unique: true } ).filter( selector );
  };

}

// Misc functions
/////////////////

util.extend( elesfn, {
  components: function(root){
    let self = this;
    let cy = self.cy();
    let visited = cy.collection();
    let unvisited = root == null ? self.nodes() : root.nodes();
    let components = [];

    if( root != null && unvisited.empty() ){ // root may contain only edges
      unvisited = root.sources(); // doesn't matter which node to use (undirected), so just use the source sides
    }

    let visitInComponent = ( node, component ) => {
      visited.merge( node );
      unvisited.unmerge( node );
      component.merge( node );
    };

    if( unvisited.empty() ){ return self.spawn(); }

    do { // each iteration yields a component
      let cmpt = cy.collection();
      components.push( cmpt );

      let root = unvisited[0];
      visitInComponent( root, cmpt );

      self.bfs({
        directed: false,
        roots: root,
        visit: v => visitInComponent( v, cmpt )
      } );

      cmpt.forEach(node => {
        node.connectedEdges().forEach(e => { // connectedEdges() usually cached
          if( self.has(e) && cmpt.has(e.source()) && cmpt.has(e.target()) ){ // has() is cheap
            cmpt.merge(e); // forEach() only considers nodes -- sets N at call time
          }
        });
      });

    } while( unvisited.length > 0 );

    return components;
  },

  component: function(){
    let ele = this[0];

    return ele.cy().mutableElements().components( ele )[0];
  }
} );

elesfn.componentsOf = elesfn.components;

export default elesfn;
