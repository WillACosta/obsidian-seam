import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveReleaseAssetUrls } from '../src/utils/releaseNotes';

describe('Release note assets', () => {
    it('resolves repository-relative images against the release tag', () => {
        const markdown = '![Showcase](./docs/images/v2.0.0/showcase.png)';

        assert.equal(
            resolveReleaseAssetUrls(markdown, '2.0.1'),
            '![Showcase](https://raw.githubusercontent.com/WillACosta/obsidian-seam/2.0.1/docs/images/v2.0.0/showcase.png)',
        );
    });

    it('leaves external and vault-relative links unchanged', () => {
        const markdown = '[Docs](https://example.com/docs) ![Vault](images/local.png)';

        assert.equal(resolveReleaseAssetUrls(markdown, '2.0.1'), markdown);
    });
});
