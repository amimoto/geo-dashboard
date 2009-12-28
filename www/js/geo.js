/***********************************************************************
 * route_directions OBJECT
 ***********************************************************************/
function route_directions ( opts ) {
/* --------------------------------------------------
 * This object handles a single Google Maps route
 */ 

    this.map              = opts["map"];
    this.route_travelmode = opts["travelmode"] ? opts["travelmode"] : G_TRAVEL_MODE_DRIVING;
    this.route_waypoints  = opts["waypoints"]  ? opts["waypoints"]  : [];
    var directions        = new GDirections();
    this.route_directions = directions;
    this.route_selected   = 0;
    this.polyline         = null;
    this.callback         = opts["callback"]   ? opts["callback"] 
                                               : function (obj) {};
    var me = this;

// Execute searching of directions...
    this.search = function ( waypoints ) {
    // --------------------------------------------------
        if (waypoints) me.route_waypoints = waypoints;
        var route_string = me.route_query_string();
        me.route_directions.load(
            route_string,
            {
                travelMode:  me.route_travelmode,
                getPolyline: true,
                getSteps:    true
            }
        );
    };

// To handle the waypoint updates
    this.waypoint_insert = function ( insert_after_index, position_name ) {
    // --------------------------------------------------
        var route_waypoints = me.route_waypoints;
        route_waypoints.splice( insert_after_index, 0, position_name );
        return route_waypoints;
    };

// To handle the waypoint modification
    this.waypoint_modify = function ( index_id, position_name ) {
    // --------------------------------------------------
        var route_waypoints = me.route_waypoints;
        route_waypoints.splice( index_id, 1, position_name );
        return route_waypoints;
    };

// To handle the waypoint deletion
    this.waypoint_remove = function ( index_id ) {
    // --------------------------------------------------
        var route_waypoints = me.route_waypoints;
        route_waypoints.splice( index_id, 1 );
        return route_waypoints;
    };

// To get a string representation of the query
    this.route_query_string = function () {
    // --------------------------------------------------
        var str = 'from: ' + me.route_waypoints.join(" to: ");
        return str;
    }

// Show and setup the ability to modify the data
    this.show = function () {
    // --------------------------------------------------
        if (!me.polyline) return;
        me.polyline.show();
    }

// Hide and remove the ability to show the data
    this.hide = function () {
    // --------------------------------------------------
        if (me.polyline) return;
        me.polyline.hide();
    }

// Mousemove event
    this.event_mousemove = function ( latlon ) {
    // --------------------------------------------------
    // If we're hovering over a route, let's find the point that's
    // closest to an edge and mark it with a vertex manipulator
    //
        me.polyline.event_mousemove(latlon);
    };

// When a newly created drag node has been moved
    this.event_edgedragend = function ( latlon, polyline ) {
    // --------------------------------------------------
    // This is different than dragging an end marker. This
    // handles the autocreation and insertion of a new 
    // detour point in the map's direction finding route
    //

    // The neat thing about the polyline events is that
    // it gives us which part of the polyline was used
    // to drag from. What we still want, for detour 
    // addition, is to know in between which two detours
    // we wish to add this new reroute. So we need to
    // translate between the dragged edge's index to the 
    // vertex edge. In this case, if the drag edge index
    // is equal to "0', then the edge goes between vertex
    // "0" and "1".
        var drag_edge = polyline.drag_edge;
        var drag_edge_index = drag_edge.i;

    // So let's find out after which geocode this edge 
    // is found
        var marker_verticies = me.marker_verticies;
        var geocode_vertex_match = null;
        for (var i=0;i<marker_verticies.length;i++) {
            if ( marker_verticies[i] < drag_edge_index ) 
                continue;
            geocode_vertex_match = i;
            break;
        }

    // Now add the new location to the waypoint list
    // and request that a new route be created
        var waypoint_name = latlon.lat() + ", " + latlon.lng();
        debug_log(waypoint_name);
        me.waypoint_insert(geocode_vertex_match,waypoint_name);

    // Now perform the search again
        me.search();

    };

// Load up google's directions and setup our hook
    GEvent.addListener(
        directions, "load", function () {

// If the polyline already exists, we should probably nuke the existing
            if ( me.polyline ) {
                me.polyline.destroy();
            }

// Upon loading, we also need to know what each search location translates to
            var directions = me.route_directions; 
            var polyline = directions.getPolyline();
            var geocodes = [];
            var markers = [];
            for ( var i = 0; i < directions.getNumGeocodes(); i++ ) {
                var geocode = directions.getGeocode(i);
                geocodes.push( geocode );
                var marker = directions.getMarker(i);
                markers.push(marker);
            }
            me.route_geocodes = geocodes;
            me.route_markers  = markers;

// So for each waypoint that we want to visit, it should be related to
// a single point in the polyline list. We will go through and match up
// each waypoint (aka. geocode) to a vertex so when we perform route
// detour addition, we can easily figure out at which point in the 
// detour list we need to add (then recalculate)
            var polyline_vertices = polyline.getVertexCount();
            var j = 0;
            var match_coords = markers[j].getLatLng();
            var marker_verticies = [];
            for ( var i = 0; i < polyline_vertices; i++ ) {
                var vertex = polyline.getVertex(i);
                if ( Math.abs( vertex.lng() - match_coords.lng() ) > .00001 ) continue;
                if ( Math.abs( vertex.lat() - match_coords.lat() ) > .00001 ) continue;
                marker_verticies[j] = i;
                var marker = markers[++j];
                if ( !marker ) break;
                match_coords = marker.getLatLng();
            }
            me.marker_verticies = marker_verticies;


            debug_logcl();
            for (var i=0;i<geocodes.length;i++) {
                var geocode = geocodes[i];
                var vertex = marker_verticies[i];
                debug_log( i + ":" + vertex + " -> " + geocode.address);
            };

// Now we can go ahead and setup the standard polyline stuff
            me.polyline = new polyline_handle({
                                map:        me.map,
                                polyline:   polyline,
                                draggable:  true,
                                cb_dragend: function (latlon,polyline) { me.event_edgedragend(latlon,polyline) }
                            });

            me.callback(me);

        }
    );
};


/***********************************************************************
 * polyline_handle OBJECT
 ***********************************************************************/
function polyline_handle ( opts ) {
/* --------------------------------------------------
 * Polyline handler. A wrapper for GPolyline for
 * some fun tricks
 */ 

    this.map           = opts["map"];
    this.map_reposition   = true;
    this.polyline      = opts["polyline"];
    this.visible       = null;
    this.draggable     = opts["draggable"]    ? opts["draggable"]    : null;
    this.cb_dragstart  = opts["cb_polyline"]  ? opts["cb_polyline"]  : null;
    this.cb_dragend    = opts["cb_dragend"]   ? opts["cb_dragend"]   : null;
    this.cb_mousemove  = opts["cb_dragstart"] ? opts["cb_dragstart"] : null;
    this.drag_marker   = null;
    this.drag_edge     = null;
    this.mouse_latlon  = null;
    this.gicon         = new GIcon({
                                  image:      "css/images/route-control-point.png",
                                  iconSize:   new GSize(16,16),
                                  iconAnchor: new GPoint(8,8)
                             });

    var me = this;

    this.show = function () {
    // --------------------------------------------------
    // Shows the polyline
    //
        if ( me.visible ) return 1;
        me.map.addOverlay(me.polyline);

// Setup the draggability event
        if ( me.draggable ) {
          me.event_mousemove_handle = GEvent.addListener(
                me.map,
                'mousemove',
                function(latlon) {

                    me.mouse_latlon = latlon;

// Ignore if we're dragging FIXME: not sure if this is the right place
// to find out if something is being dragged
                    if ( me.state_dragging ) return;
                    me.event_mousemove( latlon );
                }
          );
        }

// If we want the map to zoom to fill the space
        if ( me.map_reposition ) {
            var bounds = me.polyline.getBounds();
            var bound_zoom_level = me.map.getBoundsZoomLevel(bounds);
            me.map.setCenter( bounds.getCenter(), bound_zoom_level );
        }

        return 1;
    };

    this.hide = function () {
    // --------------------------------------------------
    // Hides the polyline from the map
    //
        if ( me.visible ) return 1;
        me.map.removeOverlay(me.polyline);
        if ( me.event_mousemove_handle ) {
            GEvent.removeListener( me.event_mousemove_handle );
            me.event_mousemove_handle = null;
        }
        return 1;
    }

    this.toggle = function () {
    // --------------------------------------------------
    // Show/Hides the polyline from the map with a single
    // function
    //
        return me.visible ?  me.hide() : me.show();
    };

    this.destroy = function () {
    // --------------------------------------------------
    // Remove all objects that are associated with this
    // polyline. Cleanup and poof, it's gone
    //
        this.hide();
        if (me.event_mousemove_handle) GEvent.removeListener(me.event_mousemove_handle);
        if (me.event_dragstart_handle) GEvent.removeListener(me.event_dragstart_handle);
        if (me.event_dragend_handle)   GEvent.removeListener(me.event_dragend_handle);
        me.polyline = null;
        debug_log('destroyed!');
    }
    
    this.event_mousemove = function ( latlon ) {
    // --------------------------------------------------
    // Handles the drawing of a edit point along the length
    // of the edge
    //
    //
        var drag_edge  = me.route_locate_edge( latlon );

// Ignore if we're dragging
        if ( me.state_dragging ) return;

// If the drag_edge is set, this means that there's an edge that's close
// and we now have a starting coordinate for this point
        if ( drag_edge ) {
          var latlng_median = map.fromContainerPixelToLatLng(drag_edge["point"]);
          me.drag_edge = drag_edge;

// Only create the marker if we need to
          if ( me.drag_marker ) {
            me.drag_marker.setLatLng(latlng_median);
          }
// Marker doesn't exist. Let's initialize it
          else {

            var marker = new GMarker( 
              latlng_median, 
              { icon: me.gicon, draggable: true } 
            );

// Add the tie point to the route
            map.addOverlay(marker);
            me.drag_marker = marker;

// Setup the events that will allow us to drag the new node point
// from one place to another. How exciting! :)
            me.event_dragstart_handle = GEvent.addListener(marker, "dragstart", function() {
              me.state_dragging = 1;
              if ( me.cb_dragstart ) me.cb_dragstart(me.mouse_latlon,me);
            });
            me.event_dragend_handle = GEvent.addListener(marker, "dragend", function() {
              me.state_dragging = null;
              map.removeOverlay(me.drag_marker);
              me.drag_marker = null;
              if ( me.cb_dragend ) me.cb_dragend(me.mouse_latlon,me);
            });
        }
      }
      else if (me.drag_marker) {
          map.removeOverlay(me.drag_marker);
          me.drag_marker = null;
      }
      return 1;

    };

    this.route_locate_edge = function ( click_loc ) {
    // --------------------------------------------------
    // Given a route and X, Y coordinates, this
    // function will attempt to place the X,Y coordinates
    // onto the edge using bounding boxes and then distance 
    // calculations
    //

        var polyline          = me.polyline;
        var polyline_vertices = polyline.getVertexCount();
        var map               = me.map;
        var point             = map.fromLatLngToContainerPixel(click_loc);

        var point_prev        = map.fromLatLngToContainerPixel(polyline.getVertex(0));
        for ( var i=1; i < polyline_vertices; i++ ) {
            var point_cur = map.fromLatLngToContainerPixel(polyline.getVertex(i));
            var point_median = me.edge_click_within( point_prev, point_cur, point, 10 );
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
}


