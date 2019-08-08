<template>
  <div class="md-nav__source mobile-only md-nav__mobile-color">
    <div v-if="$route.path.match('sdk-reference')" class="selector-container">
      <SDKSelector :items="sdkList" />
    </div>
    <div v-for="([part, links]) of headerEntries">
      <p class="md-nav__mobile-group-name">{{ part }}</p>
      <a
        v-for="link of links"
        :href="link.path"
        :title="link.label"
        class="md-source"
        data-md-state="done"
        style="display:inline-block;"
        @click.native="$emit('closeSidebar')"
      >
        <div class="md-source__repository">{{ link.label }}</div>
      </a>
    </div>
  </div>
</template>

<script>
import { getValidLinkByRootPath } from '../util.js';
import sdkList from '../sdk.json';
import headerEntries from "../header-entries.json";

export default {
  computed: {
    headerEntries() {
      return Object.entries(headerEntries)
    }
  },
  data() {
    return {
      sdkList
    };
  },
  methods: {
    generateLink(path) {
      return getValidLinkByRootPath(path, this.$site.pages);
    }
  }
};
</script>

<style>
</style>
