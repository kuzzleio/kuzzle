<template>
  <Redirect v-if="firstChild" :to="firstChild.path"/>
</template>

<script>
import Redirect from './Redirect.vue';
const { getFirstValidChild } = require('../util.js');
export default {
  components: {
    Redirect
  },
  computed: {
    firstChild() {
      return getFirstValidChild(this.$page, this.$site.pages);
    }
  }
};
</script>
