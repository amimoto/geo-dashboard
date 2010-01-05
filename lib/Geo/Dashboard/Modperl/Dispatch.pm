package Geo::Dashboard::Modperl::Dispatch;

use strict;
use CGI;
use Geo::Dashboard;
use JSON;

sub print_json {
# --------------------------------------------------
# Used by the sub applications.
# Just print the json representation of an object
#
    my $args = shift;
    print to_json($args);
}

sub dispatch {
# --------------------------------------------------
# This will figure out what the user wants to do.
# Rather unexciting
#
    my ( $pkg, $r ) = @_;

    my $in = CGI->new;
    my $uri = $r->uri;

# we're asking for a json action... let's see if 
# we can find it
    if ( $uri =~ m,^/actions/\w+\.json$, ) {
        my $fpath = "$CFG->{paths}{base}/$CFG->{paths}{templates}$uri";
        if ( -f $fpath ) {
            $r->content_type("application/json");
            {
                open my $fh, "<$fpath";
                local $/;
                my $buf = <$fh>;
                eval $buf or print to_json({error => "$@"});
                close $fh;
            };
        }
    }

# We have no idea what request is for.
    else {
        $r->content_type("text/plain");
        print "Unknown action";
    }

    return Apache2::Const::OK;
};

1;
