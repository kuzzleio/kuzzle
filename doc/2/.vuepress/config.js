const { execSync } = require('child_process');
const webpack = require('webpack');

const siteTitle = 'Kuzzle Docs';
const siteDescription = 'Kuzzle Documentation';

const versionString = require('./getVersionString');

module.exports = {
  title: siteTitle,
  description: siteDescription,
  base: process.env.SITE_BASE || '/',
  shouldPrefetch: () => false,
  head: [
    [
      'meta',
      {
        name: 'Doc-Version',
        content: versionString
      }
    ],
    [
      'meta',
      { 'http-equiv': 'Content-Type', content: 'text/html; charset=utf-8' }
    ],
    ['meta', { 'http-equiv': 'X-UA-Compatible', content: 'IE=edge,chrome=1' }],
    [
      'meta',
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, maximum-scale=1'
      }
    ],
    [
      'meta',
      {
        name: 'google-site-verification',
        content: 'luspUdq52gkUU0FFChQ2xmeXSs5HDafpARQ7fVXVBp4'
      }
    ],

    // -- Schema.org markup for Google+
    ['meta', { itemprop: 'name', content: siteTitle }],
    ['meta', { itemprop: 'image', content: '/favicon/favicon-196x196.png' }],

    // -- Twitter Card data
    ['meta', { name: 'twitter:card', value: 'summary' }],
    ['meta', { name: 'twitter:site', content: '@kuzzleio' }],
    ['meta', { name: 'twitter:title', content: siteTitle }],
    ['meta', { name: 'twitter:creator', content: '@kuzzleio' }],
    [
      'meta',
      {
        name: 'twitter:image',
        content: '/favicon-196x196.png'
      }
    ],

    // -- Open Graph data
    ['meta', { property: 'og:title', content: siteTitle }],
    ['meta', { property: 'og:type', content: 'article' }],
    ['meta', { property: 'og:site_name', content: siteTitle }],
    [
      'meta',
      {
        property: 'og:image',
        content: 'favicon/favicon-96x96.png'
      }
    ],
    // The following two fields don't seem to be meaningful
    // [
    //   'meta',
    //   {
    //     property: 'article:published_time',
    //     content: new Date().toISOString() // '{{dateToISO stats.ctime}}'
    //   }
    // ],
    // [
    //   'meta',
    //   {
    //     property: 'article:modified_time',
    //     content: '{{dateToISO stats.mtime}}'
    //   }
    // ],

    // -- Favicons
    [
      'meta',
      {
        name: 'msapplication-TileImage',
        content: '/favicon/mstile-144x144.png'
      }
    ],
    [
      'meta',
      {
        name: 'msapplication-square70x70logo',
        content: '/favicon/mstile-70x70.png'
      }
    ],
    [
      'meta',
      {
        name: 'msapplication-square150x150logo',
        content: '/favicon/mstile-150x150.png'
      }
    ],
    [
      'meta',
      {
        name: 'msapplication-square310x310logo',
        content: '/favicon/mstile-310x310.png'
      }
    ],
    [
      'meta',
      {
        name: 'msapplication-square310x150logo',
        content: '/favicon/mstile-310x150.png'
      }
    ],
    [
      'link',
      {
        rel: 'icon',
        type: 'image/png',
        href: '/favicon/favicon-196x196.png',
        sizes: '196x196'
      }
    ],
    [
      'link',
      {
        rel: 'icon',
        type: 'image/png',
        href: '/favicon/favicon-96x96.png',
        sizes: '96x96'
      }
    ],
    [
      'link',
      {
        rel: 'icon',
        type: 'image/png',
        href: '/favicon/favicon-32x32.png',
        sizes: '32x32'
      }
    ],
    [
      'link',
      {
        rel: 'icon',
        type: 'image/png',
        href: '/favicon/favicon-16x16.png',
        sizes: '16x16'
      }
    ],
    [
      'link',
      {
        rel: 'icon',
        type: 'image/png',
        href: '/favicon/favicon-128.png',
        sizes: '128'
      }
    ],
    [
      'link',
      {
        rel: 'apple-touch-icon-precomposed',
        href: '/favicon/apple-touch-icon-57x57.png',
        sizes: '57x57'
      }
    ],
    [
      'link',
      {
        rel: 'apple-touch-icon-precomposed',
        href: '/favicon/apple-touch-icon-114x114.png',
        sizes: '114x114'
      }
    ],
    [
      'link',
      {
        rel: 'apple-touch-icon-precomposed',
        href: '/favicon/apple-touch-icon-114x114.png',
        sizes: '114x114'
      }
    ],
    [
      'link',
      {
        rel: 'apple-touch-icon-precomposed',
        href: '/favicon/apple-touch-icon-72x72.png',
        sizes: '72x72'
      }
    ],
    [
      'link',
      {
        rel: 'apple-touch-icon-precomposed',
        href: '/favicon/apple-touch-icon-144x144.png',
        sizes: '144x144'
      }
    ],
    [
      'link',
      {
        rel: 'apple-touch-icon-precomposed',
        href: '/favicon/apple-touch-icon-60x60.png',
        sizes: '60x60'
      }
    ],
    [
      'link',
      {
        rel: 'apple-touch-icon-precomposed',
        href: '/favicon/apple-touch-icon-120x120.png',
        sizes: '120x120'
      }
    ],
    [
      'link',
      {
        rel: 'apple-touch-icon-precomposed',
        href: '/favicon/apple-touch-icon-76x76.png',
        sizes: '76x76'
      }
    ],
    [
      'link',
      {
        rel: 'apple-touch-icon-precomposed',
        href: '/favicon/apple-touch-icon-152x152.png',
        sizes: '152x152'
      }
    ]
  ],
  markdown: {
    anchor: {
      permalink: true,
      permalinkBefore: false,
      permalinkSymbol: ''
    },
    extendMarkdown: md => {
      md.use(require('./markdown/code-snippet'));
      md.use(require('./markdown/copy-paste-snippet-btn'));
    }
  },
  configureWebpack: {
    plugins: [
      new webpack.DefinePlugin({
        GA_ID:
          JSON.stringify(process.env.GA_ID) || JSON.stringify('UA-67035328-7'),
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
        'process.env.RESET_APP_DATA_TIMER': JSON.stringify(
          process.env.RESET_APP_DATA_TIMER
        ),
        ALGOLIA_APP_ID:
          JSON.stringify(process.env.ALGOLIA_APP_ID) ||
          JSON.stringify('4RFBRWISJR'),
        ALGOLIA_SEARCH_KEY:
          JSON.stringify(process.env.ALGOLIA_SEARCH_KEY) ||
          JSON.stringify('34968884815f91ed23d6fd7058bc561a'),
        ALGOLIA_INDEX:
          JSON.stringify(process.env.ALGOLIA_INDEX) ||
          JSON.stringify('kuzzle-documentation'),
        REPO_SLUG:
          JSON.stringify(process.env.TRAVIS_REPO_SLUG) ||
          JSON.stringify('kuzzleio/documentation')
      })
    ]
  },
  plugins: [
    require('./meta-tags-plugin/index.js'),
    process.env.ALGOLIA_WRITE_KEY
      ? [
          require('./index-to-algolia/index.js'),
          {
            algoliaAppId: process.env.ALGOLIA_APP_ID || '4RFBRWISJR',
            algoliaWriteKey: process.env.ALGOLIA_WRITE_KEY,
            algoliaIndex: process.env.ALGOLIA_INDEX || 'kuzzle-documentation'
          }
        ]
      : {
          write: true
        },
    [
      require('vuepress-frontmatter-lint'),
      // require('../../../vuepress-validate-frontmatter/index'),
      {
        dumpToFile: true,
        abortBuild: true,
        postProcessErrors: require('./validate-frontmatter/append-fixes'),
        specs: {
          type: {
            type: String,
            allowedValues: ['root', 'branch', 'page'],
            required: true
          },
          order: {
            type: Number
          },
          title: {
            type: String,
            required: true
          },
          description: {
            type: String
          },
          nosidebar: {
            type: Boolean
          },
          code: {
            type: Boolean,
            required: true
          }
        },
        exclude: [
          '/sdk/js/6/getting-started/vuejs/without-vuex/src/**/*',
          '/sdk/js/6/getting-started/vuejs/with-vuex/src/**/*'
        ]
      }
    ],
    [
      'container',
      {
        type: 'info',
        before: '<div class="alert alert-info">',
        after: '</div>'
      }
    ],
    [
      'container',
      {
        type: 'success',
        before: '<div class="alert alert-success">',
        after: '</div>'
      }
    ],
    [
      'container',
      {
        type: 'warning',
        before: '<div class="alert alert-warning">',
        after: '</div>'
      }
    ]
  ]
};
