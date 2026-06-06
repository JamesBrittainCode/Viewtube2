-- Optional cleanup: hide any previously uploaded/broken Tetris playable.
-- The fixed Tetris is now bundled at /playables/tetris and registered as a built-in game.

update public.playable_games
set is_active = false
where slug = 'tetris';
