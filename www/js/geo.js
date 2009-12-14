function route_directions ( opts ) {
/* --------------------------------------------------
 * This object handles a single Google Maps route
 */ 

    this.map_base         = opts["map"];
    this.route_travelmode = opts["travelmode"] ? opts["travelmode"] : G_TRAVEL_MODE_DRIVING;
    this.route_waypoints  = opts["waypoints"]  ? opts["waypoints"]  : [];
    var directions = new GDirections();
    this.route_directions = directions;
    this.route_selected   = 0;
    this.route_trace      = null;
    this.callback         = opts["callback"]   ? opts["callback"] 
                                               : function (obj) {};
    var closure_object = this;

// Execute searching of directions...
    this.search = function ( waypoints ) {
    // --------------------------------------------------
        if (waypoints) closure_object.route_waypoints = waypoints;
        var route_string = closure_object.route_query_string();
        closure_object.route_directions.load(
            route_string,
            {
                travelMode:  closure_object.route_travelmode,
                getPolyline: true,
                getSteps:    true
            }
        );
    };

// To handle the waypoint updates
    this.waypoint_insert = function ( insert_after_index, position_name ) {
    // --------------------------------------------------
        var route_waypoints = closure_object.route_waypoints;
        route_waypoints.splice( insert_after_index, 0, position_name );
        return route_waypoints;
    };

// To handle the waypoint modification
    this.waypoint_modify = function ( index_id, position_name ) {
    // --------------------------------------------------
        var route_waypoints = closure_object.route_waypoints;
        route_waypoints.splice( index_id, 1, position_name );
        return route_waypoints;
    };

// To handle the waypoint deletion
    this.waypoint_remove = function ( index_id ) {
    // --------------------------------------------------
        var route_waypoints = closure_object.route_waypoints;
        route_waypoints.splice( index_id, 1 );
        return route_waypoints;
    };

// To get a string representation of the query
    this.route_query_string = function () {
    // --------------------------------------------------
        var str = 'from: ' + closure_object.route_waypoints.join(" to: ");
        return str;
    }

    this.route_locate_edge = function ( click_loc ) {
    // --------------------------------------------------
    // Given a route and X, Y coordinates, this
    // function will attempt to place the X,Y coordinates
    // onto the edge using bounding boxes and then distance 
    // calculations
    //

        var route_trace          = closure_object.route_trace;
        var route_trace_vertices = route_trace.getVertexCount();
        var map                  = closure_object.map_base;
        var point                = map.fromLatLngToContainerPixel(click_loc);

        var point_prev           = map.fromLatLngToContainerPixel(route_trace.getVertex(0));
        for ( var i=1; i < route_trace_vertices; i++ ) {
            var point_cur = map.fromLatLngToContainerPixel(route_trace.getVertex(i));
            var point_median = edge_click_within( point_prev, point_cur, point, 10 );
            if ( point_median ) {
                return {
                  "point": point_median,
                  "i": i
                };
            }
            point_prev = point_cur;
        }

        return;
    };

    this.edge_click_within = function ( start_pt, end_pt, click_pt, r ) {
    // --------------------------------------------------
    // Given two vertexes and a click point, this function 
    // will return a true value if the click is found to be 
    // within the allowed ranges of the edge. Note that
    // all the points should be of GPoint using the same axis
    //

// A quick check to see if we're in the soft bounds. THis creates
// a bounding box for the edge so we can quickly see if the clickpt
// is within range of this edge
          if ( end_pt.y > start_pt.y ) {
              if ( end_pt.y   + r < click_pt.y ) return;
              if ( start_pt.y - r > click_pt.y ) return;
          }
          else {
              if ( start_pt.y + r < click_pt.y ) return;
              if ( end_pt.y   - r > click_pt.y ) return;
          }
          if ( end_pt.x > start_pt.x ) {
              if ( end_pt.x   + r < click_pt.x ) return;
              if ( start_pt.x - r > click_pt.x ) return;
          }
          else {
              if ( start_pt.x + r < click_pt.x ) return;
              if ( end_pt.x   - r > click_pt.x ) return;
          }

// So the point is within range of this edge. Let's
// run the stricter calculations through and if it
// still matches, provide the coordinates of the
// best intercept point on the edge
        var rise      = end_pt.y - start_pt.y;
        var run       = end_pt.x - start_pt.x;

        if ( rise == 0 ) {
            if ( run == 0 ) {
            }
            return;
        }
        else if ( run == 0 ) {
            return;
        }

// If there is a slope and not a perfectly flat
// or vertical line
        var slope = rise / run;
        var theta = Math.atan2( rise, Math.abs(run) );
        var B     = r / Math.cos(theta);

        var click_x = click_pt.x;
        var click_y = click_pt.y;
        var v = (click_x-start_pt.x)*slope+start_pt.y;
        if (click_y>v+B) return;
        if (click_y<v-B) return;

        var slope_v = slope * -1;

        if ( rise > 0 ) {
            if ( click_y < (click_x-start_pt.x)/slope_v+start_pt.y ) return;
            if ( click_y > (click_x-end_pt.x)/slope_v+end_pt.y )     return;
        }
        else {
            if ( click_y > (click_x-start_pt.x)/slope_v+start_pt.y ) return;
            if ( click_y < (click_x-end_pt.x)/slope_v+end_pt.y )     return;
        }

/*
 * Lets reply back with an X,Y point that relates to where
 * on the line segment the user is closest to (on a perpendicular
 * basis)
 *            end
 *           /|
 *          / | B
 *      A  /  |
 *        /  _clickpt
 *       / _/
 *  start/   C
 *
 *   A: length of edge
 *   B: distance between end point and click point
 *   C: distance between start point and click point
 *   H: (not marked) distance of click point from edge
 *
 *   Formulas from:
 *    http://softsurfer.com/Archive/algorithm_0101/algorithm_0101.htm
 *    area = .25 * sqrt( 4*a^2*b^2 - (a^2+b^2-c^2)^2 )
 *    H    = area * 2 / A
 *
 *   So:
 *    H    = .5 * sqrt( 4*a^2*b^2 - (a^2+b^2-c^2)^2 ) / A
 */
        var a = Math.sqrt(rise*rise+run*run);
        var vx = click_x - end_pt.x;
        var vy = click_y - end_pt.y;
        var b = Math.sqrt(vx*vx+vy*vy);
            vx = click_x - start_pt.x;
            vy = click_y - start_pt.y;
        var c = Math.sqrt(vx*vx+vy*vy);

        var h = .5 * Math.sqrt(
                    4 * a*a*b*b
                    - Math.pow( a*a + b*b - c*c, 2 )
                ) / a;

// At this point, it's possible to calculate the distance 
// from start that the perpendicular intercept from the clickpt
// will cross
        var ai = c * Math.sin(Math.acos(h/c));
        var p  = ai / a;
        var nx = start_pt.x + run * p;
        var ny = start_pt.y + rise * p;
        var np = new GPoint( nx, ny );
        return np;
    };

// Load up google's directions and setup our hook
    GEvent.addListener(
        directions, "load", function () {
            closure_object.route_trace = closure_object.route_directions.getPolyline();
            closure_object.callback(closure_object);
        }
    );

};

