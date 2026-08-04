import { MediaServerType } from '@server/constants/server';
import imdbRatingCache from '@server/lib/imdbRatingCache';
import { jellyfinFullScanner } from '@server/lib/scanners/jellyfin';
import { plexFullScanner } from '@server/lib/scanners/plex';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';

type InitialScanStage = 'idle' | 'library' | 'ratings' | 'complete' | 'error';

class ImdbRatingInitialScan {
  private running = false;
  private stage: InitialScanStage = 'idle';
  private error?: string;

  public status() {
    const mediaServerType = getSettings().main.mediaServerType;
    const scanner =
      mediaServerType === MediaServerType.PLEX
        ? plexFullScanner
        : jellyfinFullScanner;

    return {
      running: this.running,
      stage: this.stage,
      error: this.error,
      library: scanner.status(),
      ratings: imdbRatingCache.status(),
    };
  }

  public start(): void {
    if (this.running) return;
    void this.run();
  }

  private async run(): Promise<void> {
    this.running = true;
    this.stage = 'library';
    this.error = undefined;

    try {
      await imdbRatingCache.beginInitialScan();
      const mediaServerType = getSettings().main.mediaServerType;
      const scanner =
        mediaServerType === MediaServerType.PLEX
          ? plexFullScanner
          : jellyfinFullScanner;

      if (scanner.status().running) {
        while (scanner.status().running) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } else {
        await scanner.run();
      }

      this.stage = 'ratings';
      await imdbRatingCache.warmLibrary(mediaServerType);
      await imdbRatingCache.waitForPending();
      this.stage = 'complete';
    } catch (error) {
      this.stage = 'error';
      this.error =
        error instanceof Error ? error.message : 'Unknown initial scan error';
      logger.error('IMDb ratings initial scan failed', {
        label: 'IMDb Ratings Cache',
        errorMessage: this.error,
      });
    } finally {
      this.running = false;
    }
  }
}

export default new ImdbRatingInitialScan();
