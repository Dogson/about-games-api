USE about_games_db;

-- Populate games
INSERT INTO games (igdb_id, title, release_date, cover_img, boxart_img)
VALUES
    (101, 'Cyber Adventure', '2024-11-15', 'https://example.com/cyber_cover.jpg', 'https://example.com/cyber_boxart.jpg'),
    (102, 'Fantasy Quest', '2023-06-20', NULL, 'https://example.com/fantasy_boxart.jpg'),
    (103, 'Space Battle', '2025-01-10', 'https://example.com/space_cover.jpg', 'https://example.com/space_boxart.jpg');

-- Populate companies
INSERT INTO companies (igdb_id, name)
VALUES
    (201, 'MegaGames Studio'),
    (202, 'Epic Creators Inc.'),
    (203, 'SpaceWorks');

-- Link games and companies
INSERT INTO games_has_companies (game_id, company_id)
VALUES
    (1, 1),  -- Cyber Adventure made by MegaGames Studio
    (2, 2),  -- Fantasy Quest by Epic Creators Inc.
    (3, 3),  -- Space Battle by SpaceWorks
    (3, 2);  -- Space Battle also by MegaGames Studio

-- Populate yt_channel with parsing_attribute and regexp arrays as JSON strings
INSERT INTO yt_channel (
    name, youtube_id, description, thumbnail, language, parsing_attribute,
    ignores_episodes_containing, ignore_search_in, end_parsing_after
) VALUES
      (
          'GameSpot',
          'UCQ0UDLQCjY0rmuxCDE38FGg',
          'Official GameSpot channel covering video games, news, and reviews.',
          'https://example.com/thumbnail_gamespot.jpg',
          'en',
          'title',
          '["\\\\btrailer\\\\b", "\\\\bunboxing\\\\b"]',
          '["\\\\bspoiler\\\\b", "\\\\breview\\\\b"]',
          NULL
      ),
      (
          'IGN',
          'UCrYmtJBtLdtm2ov84ulV-yg',
          'IGN provides videos about games, movies, and entertainment.',
          'https://example.com/thumbnail_ign.jpg',
          'en',
          'description',
          '["\\\\bpreview\\\\b", "\\\\bdemo\\\\b"]',
          '["\\\\badvertisement\\\\b"]',
          NULL
      );

-- Populate videos related to yt_channels
INSERT INTO videos (
    yt_channel_id, title, description, release_date, validated, gamesFound
) VALUES
      (
          1,
          'Cyber Adventure Official Trailer',
          'Trailer for Cyber Adventure game, released in 2024.',
          '2024-10-01',
          1,
          1
      ),
      (
          2,
          'IGN Fantasy Quest Review',
          'In-depth review of Fantasy Quest game.',
          '2023-07-01',
          1,
          1
      ),
      (
          2,
          'Space Battle Gameplay Demo',
          'Demo video showing Space Battle gameplay.',
          '2025-02-15',
          0,
          1
      );

-- Link videos and games
INSERT INTO videos_has_games (video_id, game_id)
VALUES
    (1, 1), -- Cyber Adventure Trailer linked to Cyber Adventure
    (2, 2), -- IGN review linked to Fantasy Quest
    (3, 3); -- Space Battle demo linked to Space Battle

-- Populate users
INSERT INTO users (username, password_hash, admin)
VALUES
    ('admin', 'hashedpassword123', 1),
    ('user1', 'hashedpassword456', 0),
    ('user2', 'hashedpassword789', 0);
