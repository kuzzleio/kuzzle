<template>
  <div>
    <input
      class="md-toggle"
      ref="searchTrigger"
      data-md-toggle="search"
      type="checkbox"
      id="search"
      autocomplete="off"
    >
    <header class="md-header" data-md-component="header">
      <!-- Top-level navigation -->
      <nav class="md-header-nav md-grid">
        <div class="md-flex">
          <!-- Link to home -->
          <div class="md-flex__cell md-flex__cell--shrink">
            <a href="/" class="md-header-nav__button md-logo">
              <img src="/logo-min.png" width="24" height="24">
            </a>
          </div>

          <!-- Button to toggle drawer -->
          <div class="md-flex__cell md-flex__cell--shrink">
            <label
              class="md-icon md-icon--menu md-header-nav__button"
              for="drawer"
              @click="$emit('openSidebar')"
            ></label>
          </div>

          <!-- Header title -->
          <div class="md-flex__cell md-flex__cell--stretch">
            <div class="md-flex__ellipsis md-header-nav__title" data-md-component="title">
              <span class="md-header-nav__topic">Kuzzle</span>
              <span class="md-header-nav__topic">{{ $page.title }}</span>
            </div>
          </div>
           <div class="md-flex__cell md-flex__cell--stretch md-flex__cell--menu">
            <Tabs />
          </div>
          <!-- Button to open search dialogue -->
          <div class="md-flex__cell md-flex__cell--shrink">
            <label class="md-icon md-icon--search md-header-nav__button" for="search"></label>
            <!-- Search interface -->
            <ClientOnly>
              <Search
                v-if="algoliaSearchKey && algoliaAppId && algoliaIndexName"
                :app-id="algoliaAppId"
                :api-key="algoliaSearchKey"
                :index-name="algoliaIndexName"
                @search::on="toggleSearchTrigger(true)"
                @search::off="toggleSearchTrigger(false)"
              />
            </ClientOnly>
          </div>

          <!-- Repository containing source -->
          <!-- <div class="md-flex__cell md-flex__cell--shrink">
                <div class="md-header-nav__source">
                    {% include "partials/source.html" %}
                </div>
          </div>-->
        </div>
      </nav>
    </header>
  </div>
</template>

<script>
import Search from './Search.vue';
import Tabs from './Tabs.vue';

export default {
  components: {
    Search,
    Tabs
  },
  name: 'Header',
  data() {
    return {
      algoliaAppId: ALGOLIA_APP_ID,
      algoliaSearchKey: ALGOLIA_SEARCH_KEY,
      algoliaIndexName: ALGOLIA_INDEX
    };
  },
  methods: {
    toggleSearchTrigger(toggle) {
      this.$refs.searchTrigger.checked = toggle;
    }
  }
};
</script>

<style>
</style>
