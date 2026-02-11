# Privacy Controls

## Profile Privacy Settings
Stored in `member_profiles.privacy_settings`.

- `profile_visibility`: `public` | `members` | `private`
- `show_transcript`: controls transcript visibility
- `show_academy`: controls academy visibility
- `show_trades_in_feed`: controls social trade sharing eligibility
- `show_on_leaderboard`: leaderboard opt-in/opt-out
- `show_discord_roles`: controls Discord role visibility

## Visibility Matrix
- `public`: profile readable by authenticated members.
- `members`: profile readable by authenticated members.
- `private`: profile hidden from other members.

## Leaderboard Privacy
- Users are included only when `show_on_leaderboard = true`.
- Opt-out takes effect on next leaderboard snapshot run.

## Transcript Privacy
- Public profile access checks `show_transcript` before returning transcript data.

## Feed Privacy
- Shared trades support `public`, `members`, and `private` visibility.
- Feed endpoints only return `public` and `members` items for community views.
