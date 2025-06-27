# Badminton Score System (WeChat Mini Program)

A WeChat Mini Program for managing badminton matches, ELO-based player rankings, and match history, with cloud data storage and user login. Designed for clubs, groups, or individuals who want to track player performance and match results in a user-friendly, mobile-first interface.

## Features

- **Player Management**: Add, view, and delete players. Gender and win/loss stats are displayed.
- **ELO Ranking System**: Automatic ELO calculation and ranking updates after each match.
- **Match Recording**: Record new matches, select players, and update scores and rankings.
- **Cloud Database**: All player and match data is stored in the WeChat Cloud Database for persistence and sharing across devices.
- **User Login & Onboarding**: First-time users enter their name; returning users are auto-logged in.
- **Match History**: View match history for the current user, with date filtering and detailed stats.
- **Modern UI/UX**: Clean, mobile-optimized interface with clear feedback and error handling.

## Project Structure

```
assets/           # Icons and images
components/       # Reusable UI components (e.g., player-selector)
pages/            # Main app pages (user-login, game-signup, game-detail, players, player-detail, user-profile, my-match, my-profile, generate-match)
utils/            # Utility scripts and services
cloudfunctions/   # Cloud functions for backend operations
app.js            # App entry, cloud init, global config
app.json          # App routing and config
README.md         # Project documentation (this file)
```

## Setup & Usage

1. **Clone the Project**
   - Download or clone this repository to your local machine.

2. **Open in WeChat DevTools**
   - Open the WeChat Mini Program Developer Tools.
   - Import the project folder.

3. **Configure Cloud Environment**
   - Enable Cloud Development in WeChat DevTools.
   - Set up your cloud environment and database collections for `UserProfile`, `UserPerformance`, `Game`, `Match`, and `Session`.
   - Deploy cloud functions in the `cloudfunctions/` directory.

4. **Run the App**
   - Use the WeChat DevTools to preview and test the app on your device or simulator.

5. **User Onboarding**
   - On first launch, users login with WeChat and complete their profile.
   - User info is stored in cloud database and used for match filtering and history.

## Key Pages & Components

- **/pages/user-login/**: WeChat login and user registration
- **/pages/game-signup/**: Create and join badminton games
- **/pages/game-detail/**: View game details and manage players
- **/pages/players/**: Player rankings and performance stats
- **/pages/user-profile/**: User profile management and avatar editing
- **/pages/my-match/**: User's upcoming and completed matches
- **/pages/my-profile/**: User's personal match history and stats
- **/pages/generate-match/**: Generate matches from game participants
- **/components/player-selector/**: Custom dropdown for player selection

## Cloud Database Collections

- `UserProfile`: Stores user info (name, gender, avatar, etc.)
- `UserPerformance`: Stores player performance stats (ELO, win rates, etc.)
- `Game`: Stores game sessions (title, date, location, max players, etc.)
- `Match`: Stores match records (players, scores, ELO changes, etc.)
- `Session`: Stores session management data

## ELO System

- ELO ratings are updated after each match based on the result.
- Rankings are displayed on the player list page.

## Error Handling & Feedback

- All network and database operations include error handling and user feedback via `wx.showToast`.
- User-friendly messages for login, data loading, and failures.

## Customization

- Update icons in `assets/icons/` as needed.
- Adjust ELO calculation logic in cloud functions if you want to tweak ranking behavior.
- Extend player or match data models in the cloud database as needed.

## Contributing

Pull requests and suggestions are welcome! Please open an issue or PR for bug fixes, improvements, or new features.

## License

MIT License. See [LICENSE](LICENSE) for details.
