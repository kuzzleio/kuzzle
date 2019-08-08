<template>
  <div class="md-layout">
    <Header ref="header" />
    <div ref="container" class="md-container">
      <main class="md-main">
        <div class="md-main__inner md-grid" data-md-component="container">
          <!-- Main navigation -->
          <div class="md-sidebar md-sidebar--primary" data-md-component="navigation" ref="sidebar">
            <div v-if="!$page.frontmatter.nosidebar" class="md-sidebar__scrollwrap">
              <div class="md-sidebar__inner"></div>
            </div>
          </div>

          <!-- Main container -->
          <div class="md-content">
            <article class="md-content__inner md-typeset">
              <h1>404 Page not found</h1>
              <blockquote>{{ getMsg() }}</blockquote>
              <a :href="generateHomeLink('/')">Take me home.</a>
            </article>
          </div>
        </div>
      </main>
      <Footer ref="footer" />
    </div>
  </div>
</template>

<script>
import Header from './Header.vue';
import Footer from './Footer.vue';

import { getFirstValidChild, getNodeByPath } from '../util.js';

const msgs = [
  `There's nothing here.`,
  `How did we get here?`,
  `That's a Four-Oh-Four.`,
  `Looks like we've got some broken links.`
];

export default {
  components: {
    Header,
    Footer
  },
  methods: {
    getMsg() {
      return msgs[Math.floor(Math.random() * msgs.length)];
    },
    generateHomeLink(path) {
      const rootPage = getNodeByPath(path, this.$site.pages);
      return getFirstValidChild(rootPage, this.$site.pages).path;
    },
    setContainerPadding() {
      const padding = this.$refs.header.$el.querySelector('header')
        .offsetHeight;

      if (padding === null || typeof padding === 'undefined') {
        return;
      }

      this.$refs.container.style = `padding-top: ${padding}px;`;
    }
  },
  mounted() {
    this.setContainerPadding();
  }
};
</script>

<style src="./styles/main.scss" lang="scss"></style>