<template>
  <Badge type="error" :text="`Deprecated since ${version}`"/>
</template>

<script>
import Badge from '@vuepress/theme-default/global-components/Badge.vue';

export default {
  components: {
    Badge
  },
  props: {
    version: {
      type: String,
      required: true
    }
  }
};
</script>

<style>
</style>
