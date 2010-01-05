package Geo::Dashboard;

use Exporter;
our ( $UDB, $DB, $SESS, $CFG, @ISA, @EXPORT );
@ISA = 'Exporter';
@EXPORT = qw( $SESS $CFG $DB $UDB );

sub init {
# --------------------------------------------------
# Loads up the appropriate DB and configuration
# values
#
    my ( $self, $app_base_path ) = splice @_,0,2;

# Load up the configuration. Wheee
    my $conf_fpath = "$app_base_path/conf/dashboard.cfg";
    $CFG = do $conf_fpath;
    $CFG->{paths}{base} = $app_base_path;

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

