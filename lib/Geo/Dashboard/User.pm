package Geo::Dashboard::User;

use Moose;
use Geo::Dashboard;
use Geo::Dashboard::DB;

sub user_add {
# --------------------------------------------------
# Create a new user in the database if possible
#
    my ( $args ) = @_;
    my $db = Geo::Dashboard::DB::db();
    $db->prepare(q`
        insert into geod_users (
                                usr_login,
                                usr_pass,
                                usr_status
                            ) 
                            values (
                                ?,
                                ?,
                                ?
                            )
    `);
}

sub user_delete {
# --------------------------------------------------
}

sub user_login {
# --------------------------------------------------
}

sub session_allocate {
# --------------------------------------------------
}

sub session_delete {
# --------------------------------------------------
}

1;
