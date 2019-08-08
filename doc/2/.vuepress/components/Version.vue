<template>
  <div>
    <div>Site: {{ site }} </div>
    <div>Repository: {{ repository }} </div>
    <div>Commit: {{ commit }} </div>
  </div>
</template>

<script>
export default {
  props: {
    site: {
      type: String,
      required: true
    },
    repository: {
      type: String,
      required: true
    },
    commit: {
      type: String,
      required: true
    }
  },
  mounted () {
    console.log(`Site: ${this.site}`);
    console.log(`Repository: ${this.repository}`);
    console.log(`Commit: ${this.commit}`);
  }
};
</script>
