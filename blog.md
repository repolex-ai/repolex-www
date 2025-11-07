---
layout: blog-sidebar
title: Blog
---

{% if site.posts.size > 0 %}
{% assign latest_post = site.posts.first %}
<article>
    <h1>{{ latest_post.title }}</h1>
    <time datetime="{{ latest_post.date | date_to_xmlschema }}">{{ latest_post.date | date: "%B %-d, %Y" }}</time>

    <div class="content">
        {{ latest_post.content }}
    </div>
</article>
{% else %}
<p>No posts yet. Check back soon!</p>
{% endif %}
