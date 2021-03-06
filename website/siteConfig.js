/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// See https://docusaurus.io/docs/site-config for all the possible
// site configuration options.

// List of projects/orgs using your project for the users page.
// const users = [
//   {
//     caption: "User1",
//     // You will need to prepend the image path with your baseUrl
//     // if it is not '/', like: '/test-site/img/image.jpg'.
//     image: "/img/undraw_open_source.svg",
//     infoLink: "https://www.facebook.com",
//     pinned: true,
//   },
// ];

const siteConfig = {
  title: "Temit", // Title for your website.
  tagline: "RabbitMQ-backed TypeScript Microservices",
  url: "https://www.temit.dev", // Your website URL
  baseUrl: "/", // Base URL for your project */
  // For github.io type URLs, you would set the url and baseUrl like:
  //   url: 'https://facebook.github.io',
  //   baseUrl: '/test-site/',

  // Used for publishing and more
  projectName: "temit",
  organizationName: "jpwilliams",
  // For top-level user or org sites, the organization is still the same.
  // e.g., for the https://JoelMarcey.github.io site, it would be set like...
  //   organizationName: 'JoelMarcey'

  // For no header links in the top nav bar -> headerLinks: [],
  headerLinks: [
    { doc: "introduction", label: "Getting Started" },
    { doc: "api/temit", label: "API" },
    {
      href: "https://github.com/jpwilliams/temit",
      label: "Github",
      external: true,
    },
    {
      href: "https://www.npmjs.com/package/temit",
      label: "npm",
      external: true,
    },
    {
      href: "https://discord.gg/PWs8FG4",
      label: "Discord",
      external: true,
    },
  ],

  // If you have users set above, you add it here:
  // users,

  /* path to images for header/footer */
  headerIcon: "img/logo.svg",
  footerIcon: "img/logo.svg",
  favicon: "img/favicon.ico",

  /* Colors for website */
  colors: {
    primaryColor: "#0a2135",
    secondaryColor: "#213c53",
  },

  /* Custom fonts for website */
  /*
  fonts: {
    myFont: [
      "Times New Roman",
      "Serif"
    ],
    myOtherFont: [
      "-apple-system",
      "system-ui"
    ]
  },
  */

  // This copyright info is used in /core/Footer.js and blog RSS/Atom feeds.
  copyright: `Copyright © ${new Date().getFullYear()} Temit`,

  highlight: {
    // Highlight.js theme to use for syntax highlighting in code blocks.
    theme: "github",
  },

  // Add custom scripts here that would be placed in <script> tags.
  scripts: ["https://buttons.github.io/buttons.js"],

  // On page navigation for the current documentation page.
  onPageNav: "separate",
  // No .html extensions for paths.
  cleanUrl: true,

  // Open Graph and Twitter card images.
  ogImage: "img/undraw_online.svg",
  twitterImage: "img/undraw_tweetstorm.svg",

  // For sites with a sizable amount of content, set collapsible to true.
  // Expand/collapse the links and subcategories under categories.
  // docsSideNavCollapsible: true,

  // Show documentation's last contributor's name.
  // enableUpdateBy: true,

  // Show documentation's last update time.
  // enableUpdateTime: true,

  docsUrl: "",

  // You may provide arbitrary config keys to be used as needed by your
  // template. For example, if you need your repo's URL...
  repoUrl: "https://github.com/jpwilliams/temit",
  stylesheets: [
    "https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,700;1,300;1,400;1,700&display=swap",
    "https://fonts.googleapis.com/css2?family=Roboto+Mono&display=swap",
  ],
};

module.exports = siteConfig;
