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
pages/            # Main app pages (add-player, players, newGame, history, player-detail, user-login)
utils/            # Utility scripts (e.g., migrateToCloud.js)
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
   - Set up your cloud environment and database collections for `players` and `matches`.
   - (Optional) Use `utils/migrateToCloud.js` to migrate existing local data.

4. **Run the App**
   - Use the WeChat DevTools to preview and test the app on your device or simulator.

5. **User Onboarding**
   - On first launch, users are prompted to enter their name.
   - User info is stored locally and used for match filtering and history.

## Key Pages & Components

- **/pages/players/**: Player list, stats, and management
- **/pages/add-player/**: Add new players
- **/pages/newGame/**: Record a new match, update ELO
- **/pages/history/**: View match history, filter by date
- **/pages/player-detail/**: Player stats and match history
- **/pages/user-login/**: User login and onboarding
- **/components/player-selector/**: Custom dropdown for player selection

## Cloud Database Collections

- `players`: Stores player info (name, gender, stats, ELO, etc.)
- `matches`: Stores match records (players, scores, date, etc.)

## ELO System

- ELO ratings are updated after each match based on the result.
- Rankings are displayed on the player list page.

## Error Handling & Feedback

- All network and database operations include error handling and user feedback via `wx.showToast`.
- User-friendly messages for login, data loading, and failures.

## Customization

- Update icons in `assets/icons/` as needed.
- Adjust ELO calculation logic in `pages/newGame/newGame.js` if you want to tweak ranking behavior.
- Extend player or match data models in the cloud database as needed.

## Contributing

Pull requests and suggestions are welcome! Please open an issue or PR for bug fixes, improvements, or new features.

## License

MIT License. See [LICENSE](LICENSE) for details.
