<template>
  <div>
    <nav v-if="headers.length" class="md-nav md-nav--secondary">
      <label class="md-nav__title" for="toc">Table of contents</label>
      <ul class="md-nav__list" data-md-scrollfix>
        <li class="md-nav__item">
          <a :title="$page.title" class="md-nav__link">{{$page.title}}</a>
        </li>
        <li v-for="header of headers" class="md-nav__item">
          <a :href="getPath(header)" :title="header.title" class="md-nav__link">{{header.title}}</a>
        </li>
      </ul>
    </nav>
  </div>
</template>

<script>
const { resolveHeaders } = require('../util');

export default {
  computed: {
    headers() {
      return resolveHeaders(this.$page)[0].children || [];
    }
  },
  methods: {
    getPath(header) {
      const baseUrl = this.$site.base.slice(0, -1);
      return `${baseUrl}${header.path}`;
    }
  }
};
</script>

<style>
</style>
