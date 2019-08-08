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
    this.$router.push(this.to)
  }
};
</script>
