import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const root = resolve(__dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('PWA install integration boundaries', () => {
  it('loads the installer component client-side only', () => {
    const layout = read('src/components/Layout/index.tsx');

    assert.match(
      layout,
      /dynamic\([\s\S]*PwaInstallMenuItem[\s\S]*ssr: false[\s\S]*\)/
    );
    assert.doesNotMatch(layout, /@khmyznikov\/pwa-install/);
  });

  it('captures the Chromium install event before the async component loads', () => {
    const document = read('src/pages/_document.tsx');
    const installer = read('src/components/PwaInstallMenuItem/index.tsx');

    assert.match(document, /beforeinstallprompt/);
    assert.match(document, /bladeplexPwaInstallPrompt=event/);
    assert.match(document, /bladeplex-beforeinstallprompt/);
    assert.match(installer, /installer\.externalPromptEvent = capturedPrompt/);
  });

  it('uses the packaged third-party prompts directly', () => {
    const installer = read('src/components/PwaInstallMenuItem/index.tsx');

    assert.match(installer, /import '@khmyznikov\/pwa-install'/);
    assert.match(installer, /'manual-apple': 'true'/);
    assert.match(installer, /'manual-chrome': 'true'/);
    assert.match(installer, /installer\.manualHowTo = false/);
    assert.match(installer, /installer\.disableScreenshots = true/);
    assert.match(installer, /installer\.isApple26Plus = true/);
    assert.match(installer, /isPwaInstallPromotionDismissed/);
    assert.match(installer, /dismissPwaInstallPromotion/);
    assert.match(
      installer,
      /bottom: 'calc\(5rem \+ env\(safe-area-inset-bottom\)\)'/
    );
    assert.doesNotMatch(installer, /https?:\/\//);
  });

  it('localizes the install action without changing existing navigation', () => {
    const userDropdown = read('src/components/Layout/UserDropdown/index.tsx');
    const installer = read('src/components/PwaInstallMenuItem/index.tsx');
    const englishMessages = JSON.parse(
      read('src/i18n/locale/en.json')
    ) as Record<string, string>;

    assert.equal(
      englishMessages['components.Layout.UserDropdown.installBladePlex'],
      'Install BladePlex'
    );
    assert.equal(
      englishMessages['components.Layout.Sidebar.installBladePlex'],
      'Install BladePlex'
    );
    assert.match(
      read('src/components/Layout/Sidebar/index.tsx'),
      /data-testid="sidebar-install-pwa"/
    );
    assert.match(
      read('src/components/Layout/MobileMenu/index.tsx'),
      /data-testid="mobile-menu-install-pwa"/
    );
    assert.match(installer, /'disable-screenshots': 'true'/);
    assert.match(
      installer,
      /const installer = createPortal\([\s\S]*<pwa-install[\s\S]*document\.body/
    );
    assert.match(userDropdown, /href={`\/profile`}/);
    assert.match(userDropdown, /href={`\/profile\/settings`}/);
    assert.match(userDropdown, /axios\.post\('\/api\/v1\/auth\/logout'\)/);
  });

  it('keeps the service worker from caching API or authenticated responses', () => {
    const serviceWorker = read('public/sw.js');

    assert.match(serviceWorker, /event\.request\.mode === 'navigate'/);
    assert.match(serviceWorker, /cache\.add\(new Request\(OFFLINE_URL/);
    assert.doesNotMatch(serviceWorker, /cache\.put/);
  });
});
