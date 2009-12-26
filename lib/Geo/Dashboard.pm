package Geo::Dashboard;

use Moose;

our $UDB;
our $DB;
our $SESS;
our $CFG = {
    paths => {
        templates => 'www',
    },
    webserver => {
        index => 'index2.html',
    },
    database => {
        db_fname => 'dashboard.sqlite',
        user_db_fname => 'userdb_%s.sqlite',
        db_path  => 'var/data',
    },
};

sub init {
# --------------------------------------------------
# Loads up the appropriate DB and configuration
# values
#
    my ( $self ) = splice @_,0,2;

# Okay, we're made up
    $self = $self->new(@_);

# Load up the required globals (eg. config, database, etc)
    require Geo::Dashboard::DB;
    $DB = Geo::Dashboard::DB::db();

    return $self;
}

sub reset {
# --------------------------------------------------
    undef $UDB;
    undef $DB;
    undef $SESS;
}

1;

