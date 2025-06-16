    USE
    about_games_db;

    USE about_games_db;

    -- 1. Insert YouTube channels
    INSERT INTO yt_channel
    (name, youtube_handle, youtube_id, youtube_uploads_id, description, thumbnail, language, parsing_attribute, ignore_episodes_containing, ignore_search_in, end_parsing_after)
    VALUES
        ('ChannelOne', 'IGN','UC1234567890', 'UC1234567890', 'Description for ChannelOne', 'http://example.com/thumb1.jpg', 'en', 'attr1', '[]', '[]', '[]'),
        ('ChannelTwo', 'Origami', 'UC0987654321', 'UC0987654321','Description for ChannelTwo', 'http://example.com/thumb2.jpg', 'fr', 'attr2', '[]', '[]', '[]');

    -- 2. Insert games
    INSERT INTO games
    (igdb_id, title, release_date, companies, cover_img, boxart_img, ignore_during_search)
    VALUES
        (101, 'Game One', '2023-05-01', '["Company A", "Company B"]', 'http://example.com/game1cover.jpg', 'http://example.com/game1boxart.jpg', 0),
        (102, 'Game Two', '2022-11-15', '["Company C"]', 'http://example.com/game2cover.jpg', 'http://example.com/game2boxart.jpg', 0),
        (245105, 'Boss', '2022-11-15', '["Company C"]', 'http://example.com/game2cover.jpg', 'http://example.com/game2boxart.jpg', 1);

    -- 3. Insert videos linked to yt_channels
    INSERT INTO videos
    (yt_channel_id, title, youtube_id, description, release_date, validated, games_found_count, games_count)
    VALUES
        ((SELECT id FROM yt_channel WHERE name = 'ChannelOne'), 'Video 1 for ChannelOne', 'HHDHJJJDJDJDJ', 'Desc 1', '2023-05-10', 1, 1, 1),
        ((SELECT id FROM yt_channel WHERE name = 'ChannelTwo'), 'Video 1 for ChannelTwo', 'JJKHJKHKDJ','Desc 2', '2023-06-01', 0, 0, 0);

    -- 4. Link videos to games in pivot table
    INSERT INTO videos_has_games (video_id, game_id)
    VALUES
        ((SELECT v.id FROM videos v JOIN yt_channel c ON v.yt_channel_id = c.id WHERE c.name = 'ChannelOne' AND v.title = 'Video 1 for ChannelOne'),
         (SELECT g.id FROM games g WHERE g.title = 'Game One')),

        ((SELECT v.id FROM videos v JOIN yt_channel c ON v.yt_channel_id = c.id WHERE c.name = 'ChannelTwo' AND v.title = 'Video 1 for ChannelTwo'),
         (SELECT g.id FROM games g WHERE g.title = 'Game Two'));

    -- Populate users
    INSERT INTO users (username, password_hash, admin)
    VALUES ('admin', '$2a$10$P5exvoUG99CZF76moA2OPuDyHu1manW52uQ08xKrDNF69m1wbbFki', 1) -- Password: password
