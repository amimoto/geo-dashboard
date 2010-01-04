package Geo::Dashboard::Modperl;

use strict;
use vars qw/ %INC_TIMES $CONF_PATH /;
use Geo::Dashboard;
use Geo::Dashboard::Modperl::Dispatch;

sub init {
# --------------------------------------------------
# Load the appropriate configuration, initialize
# other parts of the system, blah blah blah
#
    my ( $pkg, $conf_path ) = @_;
    $CONF_PATH = $conf_path;
}

sub handler {
# --------------------------------------------------
# This function is the base entry point for all
# modperl requests
#

# Reload modules that have changed
    for my $path ( keys %INC ) {
        my $fpath       = $INC{$path};
        next unless -f $fpath;
        next unless $fpath =~ m|Geo/Dashboard.*\.pm$|;
        my $update_tics = (stat($fpath))[9];
        if ( $INC_TIMES{$path} and $INC_TIMES{$path} != $update_tics ) {
            do $fpath;
        }
        $INC_TIMES{$path} = $update_tics;
    }

# Now submit the request
    Geo::Dashboard->reset;
    Geo::Dashboard->init($CONF_PATH);
    return Geo::Dashboard::Modperl::Dispatch->dispatch(@_);
}

1;
