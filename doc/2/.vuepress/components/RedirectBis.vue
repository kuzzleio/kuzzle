<template>
  <div></div>
</template>

<script>
export default {
  props: {
    to: {
      type: String,
      required: true
    }
  },
  mounted() {
    window.location.pathname = this.to
  }
};
</script>
