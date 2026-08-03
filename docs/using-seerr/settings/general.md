---
title: General
description: Configure global and default settings for Seerr.
sidebar_position: 1
---

# General

## API Key

This is your Seerr API key, which can be used to integrate Seerr with third-party applications. Do **not** share this key publicly, as it can be used to gain administrator access!

If you need to generate a new API key for any reason, simply click the button to the right of the text box.

If you want to set the API key, rather than letting it be randomly generated, you can use the API_KEY environment variable. Whatever that variable is set to will be your API key.

## MDBList API Key

The BladePlex owner can configure an MDBList API key at the bottom of **Settings → General**. Obtain a key from the [MDBList API preferences](https://mdblist.com/preferences/) page. The key is stored in the persistent `config/settings.json` application settings and is used only by the server; API responses and the settings form return a mask instead of the stored secret.

BladePlex currently uses the official MDBList list at `https://mdblist.com/lists/official/movies/justwatch-streaming-charts` for the **United States Daily Streaming Charts: Movies** homepage section and native full-page grid. BladePlex requests up to the MDBList API maximum of 1,000 ranked items; the chart currently returns 150 movies even though the MDBList webpage presents its first 20. The complete validated source list is cached globally for three hours, with stale data retained for up to 24 hours when a refresh fails. BladePlex paginates that shared cache locally in 20-item pages, so opening or scrolling the full grid does not consume another MDBList request. The optional homepage section is hidden when no key is configured and no stale chart is available.

Administrators can add additional public or official movie and TV/show lists under **Settings → Custom Lists**. Paste an MDBList URL, review the validated title and preview, and select **Add to Discover**. BladePlex creates a native Discover slider and a linked full-page grid. Use **Customize Discover** on the home page to reorder or hide it. Removing a custom list removes its managed slider but does not alter the source list on MDBList.

The BladePlex owner can manage movie and TV **Collections** under **Settings → Collections** without changing application code. Paste a public or official HTTPS MDBList URL in the form `https://mdblist.com/lists/owner/list-slug`, validate it, optionally override the visible title, and save it. Validation uses the official API—not the submitted webpage—and rejects private, inaccessible, malformed, shared-token, and unsupported lists. Movie and TV records are managed in separate ordered sections with visibility toggles, editing, tile overlay colors, deletion, manual validation refresh, and **Shuffle Artwork**.

Enabled collections appear in separate configurable **Movie Collections** and **TV Collections** Discover rows. Each landscape tile uses a persisted poster selected from successfully hydrated TMDb media, with an owner-selected color overlay for legible text. Artwork remains stable across requests and restarts; **Shuffle Artwork** selects a different cached eligible poster where possible. A native placeholder is used when no poster is available.

**Collections** and legacy **Custom Lists** are independent. The same MDBList URL may be configured once in each feature; editing or deleting one does not change the other. During upgrades, previously shared records are copied so the existing Custom List remains intact while an independent Collection is created with the same title, ordering, visibility, and artwork.

Collection pages use `/discover/movies/mdblist/{collectionId}` and accept only stored numeric collection IDs. MDBList rank is the default order. Release date, title, rating, popularity, genre, year, minimum-rating, availability, and hide-available controls operate on the normalized cached collection. **Shuffle** generates a deterministic seed stored in the URL, so pagination, refresh, browser history, and shared links retain the same order without changing the source list or tile artwork.

MDBList source data is cached for three hours, with stale fallback for up to 24 hours and a five-minute failed-refresh cooldown. Cursor pagination retrieves up to 1,000 items per request and BladePlex caps configured collections at 100 and source lists at 10,000 items. Private lists and shared-token URLs are intentionally unsupported. MDBList account request quotas still apply.

Public and official MDBList movie and TV/show lists are supported. Private lists are rejected. List URLs are strictly validated as HTTPS `mdblist.com` URLs, and clients can never choose an arbitrary API hostname or endpoint. Each list uses the reusable server-side MDBList provider, runtime validation, stable TMDb/IMDb identifiers, TMDb hydration, and an isolated shared cache.

MDBList requires its API key for official-list item requests and applies account-level request quotas. BladePlex therefore refreshes this shared chart independently of visitors rather than requesting it once per browser session.

## IMDb Ratings Cache

BladePlex uses the configured MDBList API key to retrieve only IMDb-source ratings and IMDb vote counts for both movies and TV shows. Ratings remain stored in the existing persistent database cache and normal page rendering never waits for MDBList: an uncached title is queued for a bounded background batch and displays the existing IMDb link until a rating is available.

The **IMDb Ratings Cache Refresh** job under **Settings → Jobs & Cache** refreshes due ratings weekly by default and can be rescheduled or run manually. Successful cached values are retained when MDBList is unavailable, returns a partial batch, or reports no rating for an individual title. Provider failures use persisted exponential retry timing and an isolated ratings cooldown, while title-level missing results are retried less frequently. Rating requests preserve quota headroom for MDBList Collections.

After a successful Plex or Jellyfin library scan, BladePlex also seeds uncached library titles and warms their ratings asynchronously. Full scans populate fresh installations, while later full or recently-added scans enqueue only new or unresolved titles that are eligible for retry. Rating warming never delays or fails the media-library scan and continues to respect the MDBList quota reserve, retry policy, and ratings circuit breaker.

Batch requests default to 10 titles. Supporter accounts can raise the bounded batch size with `MDBLIST_RATINGS_BATCH_SIZE` (maximum 100) without changing the cache architecture. Clearing **IMDb Ratings (Persistent)** is destructive, requires explicit confirmation, and causes badges to repopulate gradually through background and scheduled work.

## Application Title

If you aren't a huge fan of the name "Seerr" and would like to display something different to your users, you can customize the application title!

## Application URL

Set this to the externally-accessible URL of your Seerr instance.

You must configure this setting in order to enable password reset and generation emails.

## Enable Image Caching

When enabled, Jellseerr will proxy and cache images from pre-configured sources (such as TMDB). This can use a significant amount of disk space.

Images are saved in the `config/cache/images` and stale images are cleared out every 24 hours.

You should enable this if you are having issues with loading images directly from TMDB in your browser.

## Display Language

Set the default display language for Seerr. Users can override this setting in their user settings.

## Discover Region, Discover Language & Streaming Region

These settings filter content shown on the "Discover" home page based on regional availability and original language, respectively. The Streaming Region filters the available streaming providers on the media page. Users can override these global settings by configuring these same options in their user settings.

## Blocklist Region and Blocklist Language

These settings control the region and language used specifically for blocklist content scanning. The "Process Blocklisted Tags" job uses these settings to determine which content to scan for blocklisting, independent of the general Discover settings.

- **Blocklist Region**: The region used for blocklist content scanning. Leave empty to scan all regions.
- **Blocklist Language**: The language used for blocklist content scanning. Leave empty to scan all languages.

These settings are separate from the general "Discover Region" and "Discover Language" settings, allowing you to blocklist content from specific regions/languages regardless of what users see in their Discover pages.

## Blocklist Content with Tags and Limit Content Blocklisted per Tag

These settings blocklist any TV shows or movies that have one of the entered tags. The "Process Blocklisted Tags" job adds entries to the blocklist based on the configured blocklisted tags. If a blocklisted tag is removed, any media blocklisted under that tag will be removed from the blocklist when the "Process Blocklisted Tags" job runs.

The limit setting determines how many pages per tag the job will process, with each page containing 20 entries. The job cycles through all 16 available discovery sort options, querying the defined number of pages to blocklist media that is most likely to appear at the top of each sort. Higher limits will create a more accurate blocklist, but will require more storage.

Blocklisted tags are disabled until at least one tag is entered. These settings cannot be overridden in user settings.

## Hide Available Media

When enabled, media which is already available will not appear on the "Discover" home page, or in the "Recommended" or "Similar" categories or other links on media detail pages.

Available media will still appear in search results, however, so it is possible to locate and view hidden items by searching for them by title.

This setting is **disabled** by default.

## Hide Blocklisted Items

When enabled, media that has been blocklisted will not appear on the "Discover" home page, for all administrators. This can be useful to hide content that you don't want to see, such as content with specific tags or content that has been manually blocklisted when you have the "Manage Blocklist" permission.

This setting is **disabled** by default.

## Allow Partial Series Requests

When enabled, users will be able to submit requests for specific seasons of TV series. If disabled, users will only be able to submit requests for all unavailable seasons.

This setting is **enabled** by default.
