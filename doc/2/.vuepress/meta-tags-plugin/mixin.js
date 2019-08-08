export default {
  mounted() {
    const head = document.head;
    const tag = document.createElement('meta');
    tag.setAttribute('property', 'article:tag');
    tag.setAttribute('content', this.$page.title);
    head.appendChild(tag);
    // TODO add article:section tag
  }
};
