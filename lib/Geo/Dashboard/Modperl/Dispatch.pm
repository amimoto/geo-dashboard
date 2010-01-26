package Geo::Dashboard::Modperl::Dispatch;

use strict;
use CGI;
use Geo::Dashboard;
use Geo::Dashboard::User;
use JSON;
our $R;

sub print_json {
# --------------------------------------------------
# Used by the sub applications.
# Just print the json representation of an object
#
    my ( $args, $opts ) = @_;

# We will set (what appears to be) the proper mimetype
# for the json response.
    $R->content_type("application/json");

# We will handle cookies if there are any to send
    if (my $cookies=$opts->{cookies}) {
        require CGI::Cookie;
        my $headers_out = $R->headers_out;
        for my $c (@$cookies) {
            my $cookie = CGI::Cookie->new(%$c);
            $headers_out->add("Set-Cookie",$cookie);
        }
    };

# Send the JSON object to the browser
    my $json_data = to_json($args);
    warn "JSON: $json_data\n";
    print $json_data;
}

sub print_json_success {
# --------------------------------------------------
# Just wrap the json response with a header to describe
# success!!
#
    my ( $args, $opts ) = @_;
    return print_json({success=>1,data=>$args},$opts);
}

sub print_json_error {
# --------------------------------------------------
# Just dumps an error message to stdout. Whoops! :)
#
    my ( $message ) = @_;
    print_json({error=>$message});
}

sub dispatch {
# --------------------------------------------------
# This will figure out what the user wants to do.
# Rather unexciting
#
    my ( $pkg, $r ) = @_;

    my $in = CGI->new;
    my $uri = $r->uri;
    $R = $r;

# Copy over the API. This just handles the situation where
# the reequest method was POST but the api_key was passed as
# parto f a QUERY_STRING
    if ( $ENV{QUERY_STRING} =~ /\bapi_key=(\w+)/ ) {
        $in->param(api_key=>$1);
    }

# If the user has provided us with a session key, let's authenticate them
    if ( my $sess_key = $in->param('s') || $in->cookie('s') ) {
        Geo::Dashboard::User->user_init($sess_key);
    }

# Just in case someone's trying to do something sneaky
    $uri =~ s,\.\.+,,g;
    $uri =~ s,\/\/+,\/,g;

# we're asking for a json action... let's see if 
# we can find it
    if ( $uri =~ m,^/actions/\w+\.json$, ) {
        my $fpath = "$CFG->{paths}{base}/$CFG->{paths}{templates}$uri";
        if ( -f $fpath ) {
            {
                open my $fh, "<$fpath";
                local $/;
                my $buf = <$fh>;
                eval $buf or print_json_error( $E->message || "$@" );
                close $fh;
            };
        }
    }

# If we're just asking for a phtml file (parsed perl html)
    elsif ( $uri =~ m,\.phtml$, ) {
        require Geo::Dashboard::Parser;
        my $parser = Geo::Dashboard::Parser->new({
                            root_path => "$CFG->{paths}{base}/$CFG->{paths}{templates}",
                            cache => 0,
                            compile_header => q`#line 1:eval
                            sub {
                                local $TEMPLATE_OUTPUT = '';
                                my $R = $OPTS->{R};
                                my $in = $OPTS->{in};`,
                        });
        my $fpath = "$CFG->{paths}{base}/$CFG->{paths}{templates}$uri";
        if ( -f $fpath ) {
# We need to strip the leading slash from the path
            $uri =~ s,^\/+,,;
            $r->content_type("text/html");
            my $data = $parser->parse(
                                $uri,
                                $fpath,
                                {
                                    R => $r,
                                    in => $in
                                }
                            );
            print $data;
        }
    }

# We have no idea what request is for.
    else {
        $r->content_type("text/plain");
        print "Unknown action";
    }

# Free $R :)
    $R = undef;
    $r = undef;

    return Apache2::Const::OK();
};

1;
