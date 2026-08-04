# BladePlex User Guide

BladePlex helps you discover movies and series, request titles for your media library, and follow each request until it becomes available. The options you see depend on the permissions and services configured by your BladePlex administrator.

## Open BladePlex

Open the BladePlex address provided by your administrator. For a local installation using the example Docker configuration, visit <http://localhost:5059>.

If BladePlex is available through a domain or Cloudflare Tunnel, use that address instead. Save or install only an address you trust.

## Sign in

The sign-in options depend on how the administrator configured BladePlex.

### Plex

1. Select **Use your Plex account**.
2. Sign in to Plex if prompted.
3. Authorize BladePlex to use your Plex account.
4. Return to BladePlex after authorization completes.

### Jellyfin or Emby

1. Enter your media-server username and password.
2. Enter the server address or Base URL if the sign-in page requests it.
3. Select **Sign In**.

If **Quick Connect** is available, select it and enter the displayed code in your Jellyfin or Emby app.

### Local account

1. Select **Local user? Sign in here**.
2. Enter the email address and password assigned to your account.
3. Select **Sign In**.

If you cannot sign in or do not have an account, contact your BladePlex administrator. Do not send anyone your password or authentication token.

## Install BladePlex as an app

BladePlex is a Progressive Web App (PWA). Installing it adds an app icon and opens BladePlex in its own window. Your BladePlex site normally needs to use HTTPS; `localhost` is the standard exception.

### Chrome on Windows, macOS, or Linux

1. Open BladePlex in Chrome and sign in.
2. Open your user menu and select **Install BladePlex**. If that option is not shown, select the install icon in Chrome's address bar or open Chrome's menu and choose **Install BladePlex**.
3. Confirm by selecting **Install**.

Chrome adds BladePlex to your installed apps and may offer to create a desktop or taskbar shortcut.

### Chrome on Android

1. Open BladePlex in Chrome and sign in.
2. Select **Install BladePlex** in BladePlex, or open Chrome's menu and select **Install app** or **Add to Home screen**.
3. Confirm the installation.

### iPhone or iPad

For the most consistent installation experience on iOS or iPadOS, use Safari:

1. Open BladePlex in Safari and sign in.
2. Tap the **Share** button.
3. Scroll down and select **Add to Home Screen**.
4. Confirm the name, then tap **Add**.
5. Open BladePlex from its new Home Screen icon.

If **Add to Home Screen** is missing, scroll to the bottom of the Share sheet, select **Edit Actions**, and enable it. Installation choices in Chrome on iOS vary by iOS version; opening the same address in Safari is the reliable fallback.

### Update or remove the installed app

The PWA uses the same BladePlex server as your browser. Server updates do not require reinstalling the PWA. Close and reopen the app, or refresh it, after an administrator announces an update.

To remove BladePlex, uninstall it like any other desktop or mobile app. Removing the PWA does not delete your BladePlex account or requests.

## Find something to watch

### Discover

The **Discover** page contains rows such as trending titles, popular movies and series, upcoming releases, recently added media, your watchlist, and administrator-curated lists. Select a poster to open its details page.

Available rows can differ between installations. An administrator may add custom MDBList collections, change their order, or hide sections.

### Search

1. Select the search field or search icon.
2. Enter a movie, series, or person.
3. Select the correct result.

Use the title's year, artwork, overview, cast, ratings, and release information to confirm that you selected the intended item.

### Browse and filter

The Movies and Series pages can be sorted and filtered by options such as genre, release date, language, content rating, streaming service, runtime, studio, network, and rating. Select **Clear Active Filters** to return to the unfiltered view.

## Understand media status

A title or season can display statuses such as:

- **Available:** It is already in the connected media library. Use **Play on Plex**, **Play on Jellyfin**, or **Play on Emby** when that option is available.
- **Partially Available:** Only some seasons or episodes are available.
- **Pending:** The request is waiting for an administrator's approval.
- **Approved** or **Processing:** The request was accepted and is being handled by the configured download services.
- **Unavailable:** The title is not currently in the library and can be requested if you have permission.

Status changes are not always immediate. BladePlex relies on its connected media server, Radarr, and Sonarr to report progress.

## Request a movie

1. Find and open the movie.
2. Select **Request Movie**.
3. Review the request. If your account has advanced-request permissions, you may also see choices such as quality profile, destination server, root folder, or tags.
4. Select **Request** to confirm.

The result depends on your permissions:

- An automatically approved request is sent to Radarr immediately.
- A pending request waits for an administrator to approve it.
- A request may be blocked if you have reached your quota or do not have movie-request permission.

If the movie is already available, BladePlex shows its availability instead of creating a duplicate request. A separate 4K request option appears only when the administrator has enabled it and your account has permission.

## Request a series

1. Find and open the series.
2. Select **Request Show**.
3. Select the seasons you want. Seasons already available or already requested are identified in the request window.
4. Review any available options, then submit the request.

Series quotas are usually counted by season. If you cannot select every season, you may have reached your request limit or some seasons may already be available, pending, or requested.

## Follow and manage your requests

Open **Requests** from the navigation menu or your user menu. Depending on your permissions, you can:

- View your requests and their current status.
- Sort requests by recent activity or modification date.
- Open a request to see its details.
- Edit or cancel a pending request.
- Request additional seasons from a series page.

Administrators and request managers may also approve, decline, retry, edit, or delete other users' requests. If an option is missing, your account likely does not have that permission.

## Use your watchlist

When enabled, **Your Watchlist** appears on Discover. Plex users can add media to their Plex Watchlist and allow BladePlex to synchronize it. BladePlex also provides watchlist controls on supported title pages.

If your administrator grants auto-request permission and you enable **Auto-Request Movies** or **Auto-Request Series** in your profile, eligible Plex Watchlist additions can be submitted automatically. Review this setting before enabling it because watchlist items may count toward your quota.

## React to titles

BladePlex community reactions let signed-in users like or dislike movies and series. Open a title and select the appropriate reaction. The totals reflect reactions from users of the same BladePlex installation, not global ratings.

## Report a playback problem

If you have permission to report issues:

1. Open the affected movie or series.
2. Select **Report Issue**.
3. Choose the issue type, such as video, audio, subtitles, or other.
4. Describe the problem clearly and submit it.

Include useful details such as the affected season and episode, language, device, and what happened. Do not include passwords, API keys, or access tokens. You can follow replies and resolution status from **Issues** when your permissions allow it.

## Manage your profile and notifications

Open your user menu and select **Profile** or **Settings**. Depending on your account and permissions, you can update options such as:

- Display name and email address
- Display and discovery language
- Discovery and streaming region
- Linked media-server accounts
- Plex Watchlist auto-request preferences
- Notification preferences

Your profile also shows your movie and series request limits. Some settings are controlled by the administrator and cannot be changed by regular users.

## Sign out

Open your user menu and select **Sign Out**. On a shared device, also close the browser or installed PWA after signing out.

## Troubleshooting

### The install option is missing

- Confirm that you opened BladePlex over HTTPS or from `localhost`.
- Refresh the page after signing in.
- Check the browser's address bar or menu for its native install option.
- On iPhone or iPad, use Safari and **Share** > **Add to Home Screen**.
- BladePlex may already be installed.

### A request button is missing or disabled

The title may already be available or requested, or your account may lack permission or available quota. Check the title's status and your profile, then contact the administrator if the result seems incorrect.

### A requested title is taking a long time

BladePlex submits and tracks requests but does not control title availability, indexers, download speeds, or release dates. Check the request status and contact the administrator if it remains failed or unchanged unexpectedly.

### The app shows old information after an update

Refresh the page. If BladePlex is installed as a PWA, close it completely and reopen it. As a final step, clear the site's cached data and sign in again; this does not delete server-side requests or settings.

### Notifications are not arriving

Confirm that notifications are enabled in your BladePlex profile and permitted by the browser or operating system. Available notification methods depend on what the administrator configured.

## Get help

For account access, permissions, quotas, request status, and playback issues, contact the administrator of your BladePlex installation. For a reproducible BladePlex software problem, report it through the project's [GitHub Issues](https://github.com/sbv29/bladeplex/issues) page without including private server details or credentials.
