/***************************************************
*** Users
****************************************************/
create table geo_users (
    usr_id     integer primary key asc,
    usr_user   varchar(50),
    usr_pass   varchar(64),
    usr_status integer
);

/***************************************************
*** Sessions
****************************************************/
create table geo_sessions (
    ses_id     integer primary key asc,
    usr_id_fk  integer,
    ses_key    varchar(255),
    ses_data   text
);

/***************************************************
*** Tracks
****************************************************/
create table geo_tracks (
    trk_id     integer primary key asc,
    usr_id_fk  integer,
    trk_name   varchar(255),
    trk_desc   text,
    trk_data   text
);

/***************************************************
*** Waypoints
****************************************************/
create table geo_waypoints (
    wpt_id     integer primary key asc,
    usr_id_fk  integer,
    wpt_name   varchar(255),
    wpt_desc   text
);


