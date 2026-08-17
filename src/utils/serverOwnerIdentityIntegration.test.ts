import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const root = resolve(__dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('server owner identity rendering', () => {
  it('uses user ID 1, the configured purple, and a small crown badge', () => {
    const identity = read(
      'src/components/Common/ServerOwnerIdentity/index.tsx'
    );
    const styles = read('src/styles/globals.css');

    assert.match(identity, /SERVER_OWNER_ID = 1/);
    assert.match(identity, /👑/);
    assert.match(identity, /text-\[0\.65em\]/);
    assert.match(identity, /inline-block align-middle/);
    assert.match(styles, /\.server-owner-name[\s\S]*#8c53a4 !important/);
    assert.match(styles, /\.server-owner-avatar[\s\S]*0 0 0 2px #8c53a4/);
  });

  it('reuses the owner name and avatar treatment across user-facing surfaces', () => {
    const identitySurfaces = [
      'src/components/RequestCard/index.tsx',
      'src/components/RequestBlock/index.tsx',
      'src/components/RequestList/RequestItem/index.tsx',
      'src/components/UserProfile/ProfileHeader/index.tsx',
      'src/components/Layout/UserDropdown/index.tsx',
      'src/components/IssueList/IssueItem/index.tsx',
      'src/components/IssueDetails/index.tsx',
      'src/components/IssueDetails/IssueComment/index.tsx',
      'src/components/CommunityReactions/index.tsx',
      'src/components/UserList/index.tsx',
      'src/components/Blocklist/index.tsx',
      'src/components/RequestModal/AdvancedRequester/index.tsx',
    ];

    for (const surface of identitySurfaces) {
      const source = read(surface);
      assert.match(source, /ServerOwnerName/, surface);
      assert.match(source, /serverOwnerAvatarClass/, surface);
    }
  });

  it('does not apply the service-status pulse to the owner avatar', () => {
    const dropdown = read('src/components/Layout/UserDropdown/index.tsx');

    assert.match(dropdown, /const currentUserIsOwner = isServerOwner/);
    assert.match(dropdown, /statusIndicatorEnabled && !currentUserIsOwner/);
  });

  it('uses the owner purple for recent request cards made by the owner', () => {
    const requestCard = read('src/components/RequestCard/index.tsx');

    assert.match(
      requestCard,
      /isServerOwner\(requestData\.requestedBy\.id\)[\s\S]*ring-\[#8c53a4\][\s\S]*ring-gray-700/
    );
  });
});
