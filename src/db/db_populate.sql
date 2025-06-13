-- Populate companies
INSERT INTO companies (igdb_id, name) VALUES
                                          (101, 'Naughty Dog'),
                                          (102, 'CD Projekt Red'),
                                          (103, 'Valve Corporation');

-- Populate games
INSERT INTO games (igdb_id, title, release_date, cover_img, boxart_img) VALUES
                                                                            (201, 'The Last of Us Part II', '2020-06-19', 'https://example.com/tlou2_cover.jpg', 'https://example.com/tlou2_boxart.jpg'),
                                                                            (202, 'Cyberpunk 2077', '2020-12-10', 'https://example.com/cp2077_cover.jpg', 'https://example.com/cp2077_boxart.jpg'),
                                                                            (203, 'Half-Life: Alyx', '2020-03-23', 'https://example.com/hl_alyx_cover.jpg', 'https://example.com/hl_alyx_boxart.jpg');

-- Link games and companies
INSERT INTO games_has_companies (games_id, companies_id) VALUES
                                                             (1, 1),  -- The Last of Us Part II by Naughty Dog
                                                             (2, 2),  -- Cyberpunk 2077 by CD Projekt Red
                                                             (3, 3);  -- Half-Life: Alyx by Valve Corporation

-- Populate YouTube channels
INSERT INTO yt_channel (name, youtube_id, description, thumbnail, language) VALUES
                                                                                ('PlayStation', 'UC-playstation', 'Official PlayStation channel', 'https://example.com/ps_thumb.jpg', 'en'),
                                                                                ('CD Projekt RED', 'UC-cdprojekt', 'Official CD Projekt RED channel', 'https://example.com/cdpr_thumb.jpg', 'en'),
                                                                                ('Valve', 'UC-valve', 'Valve official channel', 'https://example.com/valve_thumb.jpg', 'en');

-- Populate videos
INSERT INTO videos (yt_channel_id, title, description, release_date) VALUES
                                                                         (1, 'The Last of Us Part II Trailer', 'Official trailer for TLOU Part II', '2020-05-29'),
                                                                         (2, 'Cyberpunk 2077 Launch Trailer', 'Launch trailer for Cyberpunk 2077', '2020-12-09'),
                                                                         (3, 'Half-Life: Alyx Announcement', 'Announcement of Half-Life: Alyx', '2019-11-21');

-- Link videos and games
INSERT INTO videos_has_games (videos_id, videos_yt_channel_id, games_id) VALUES
                                                                             (1, 1, 1),  -- TLOU2 trailer linked to TLOU2 game
                                                                             (2, 2, 2),  -- CP2077 launch trailer linked to CP2077 game
                                                                             (3, 3, 3);  -- HL Alyx announcement linked to HL Alyx game

-- Populate users (one admin)
INSERT INTO users (username, password_hash, admin) VALUES
    ('admin', '$2b$12$examplehashedpasswordstring', 1);
