function route_directions ( opts ) {
/* --------------------------------------------------
 * This object handles a single Google Maps route
 */ 

    this.map_base         = opts["map"];
    this.route_travelmode = opts["travelmode"] ? opts["travelmode"] : G_TRAVEL_MODE_DRIVING;
    this.route_waypoints  = [];
    this.route_directions = new GDirections();
    this.route_selected   = 0;
    this.route_trace      = null;
    this.callback         = opts["callback"] = function (obj) {};

// Load up google's directions and setup our hook
    GEvent.addListener(
        this.directions, "load", function () {
            this.callback(this);
        }
    );

// Execute searching of directions...
    this.search = function ( waypoints ) {
    // --------------------------------------------------
        var route_string = this.route_query_string();
        this.route_directions.load(
            route_query_string,
            {
                travelMode:  this.route_travelmode,
                getPolyline: true,
                getSteps:    true
            }
        );
    };

// To handle the waypoint updates
    this.waypoint_insert = function ( insert_after_index, position_name ) {
    // --------------------------------------------------
        var route_waypoints = this.route_waypoints;
        route_waypoints.splice( insert_after_index, 0, position_name );
        return route_waypoints;
    };

// To handle the waypoint modification
    this.waypoint_modify = function ( index_id, position_name ) {
    // --------------------------------------------------
        var route_waypoints = this.route_waypoints;
        route_waypoints.splice( index_id, 1, position_name );
        return route_waypoints;
    };

// To handle the waypoint deletion
    this.waypoint_remove = function ( index_id ) {
    // --------------------------------------------------
        var route_waypoints = this.route_waypoints;
        route_waypoints.splice( index_id, 1 );
        return route_waypoints;
    };

// To get a string representation of the query
    this.route_query_string () {
    // --------------------------------------------------
        return 'from: ' + this.route_waypoints.join(" to: ");
    }

};

