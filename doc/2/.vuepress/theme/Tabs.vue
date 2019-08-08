<template>
  <!-- Tabs with outline -->
  <nav class="md-tabs" data-md-component="tabs">
    <div class="md-tabs__inner md-grid">
      <ul class="md-tabs__list">
        <li class="md-tabs__group" v-for="([part, links]) of headerEntries">
          <p class="md-tabs__group-name">{{ part }}</p>
          <ul class="md-tabs__group-items">
            <li class="md-tabs__item" v-for="link of links">
              <a
                :href="link.path"
                :class="{'md-tabs__link--active': $route.path.match(link.path)}"
                :title="link.label"
                class="md-tabs__link"
              >{{ link.label }}</a>
            </li>
          </ul>
        </li>
      </ul>
    </div>
  </nav>
</template>

<script>
import { getValidLinkByRootPath } from "../util.js";
import headerEntries from "../header-entries.json";

export default {
  computed: {
    headerEntries() {
      return Object.entries(headerEntries);
    }
  },
  methods: {
    startWith(str, start) {
      return str.indexOf(start) === 0;
    },
    generateLink(path) {
      return getValidLinkByRootPath(path, this.$site.pages);
    }
  }
};
</script>

<style>
</style>
