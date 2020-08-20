module.exports = {
  title: "Temit",
  tagline: "RabbitMQ-backed TypeScript Microservices",
  url: "https://www.temit.dev",
  baseUrl: "/",
  onBrokenLinks: "throw",
  favicon: "img/favicon.ico",
  organizationName: "jpwilliams", // Usually your GitHub org/user name.
  projectName: "temit", // Usually your repo name.
  themeConfig: {
    prism: {
      defaultLanguage: "typescript",
    },
    navbar: {
      title: "Temit",
      logo: {
        alt: "Temit Logo",
        src: "img/logo.svg",
      },
      items: [
        {
          to: "docs/",
          activeBaseRegex: "^(.*docs\\/(?!(api\\/?)).*)",
          label: "Docs",
          position: "right",
        },
        {
          to: "docs/api/temit",
          activeBasePath: "docs/api",
          label: "API",
          position: "right",
        },
        { to: "blog", label: "Blog", position: "right" },
        {
          href: "https://github.com/jpwilliams/temit",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Docs",
          items: [
            {
              label: "Style Guide",
              to: "docs/",
            },
            {
              label: "Second Doc",
              to: "docs/doc2/",
            },
          ],
        },
        {
          title: "Community",
          items: [
            {
              label: "Stack Overflow",
              href: "https://stackoverflow.com/questions/tagged/temit",
            },
            {
              label: "Discord",
              href: "https://discordapp.com/invite/docusaurus",
            },
            {
              label: "Twitter",
              href: "https://twitter.com/docusaurus",
            },
          ],
        },
        {
          title: "More",
          items: [
            {
              label: "Blog",
              to: "blog",
            },
            {
              label: "GitHub",
              href: "https://github.com/jpwilliams/temit",
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Temit. Built with Docusaurus.`,
    },
  },
  presets: [
    [
      "@docusaurus/preset-classic",
      {
        docs: {
          // It is recommended to set document id as docs home page (`docs/` path).
          homePageId: "introduction",
          sidebarPath: require.resolve("./sidebars.js"),
          // Please change this to your repo.
          editUrl:
            "https://github.com/jpwilliams/temit/edit/master/website/docs",
        },
        blog: {
          showReadingTime: true,
          // Please change this to your repo.
          editUrl:
            "https://github.com/jpwilliams/temit/edit/master/website/blog/",
        },
        theme: {
          customCss: require.resolve("./src/css/custom.css"),
        },
      },
    ],
  ],
};
