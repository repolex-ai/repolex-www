---
layout: default
title: Blog
---

<h2>Technical Blog</h2>

<ul class="blog-list">
{% for post in site.posts %}
    <li>
        <h3><a href="{{ post.url | relative_url }}">{{ post.title }}</a></h3>
        <p class="post-date">{{ post.date | date: "%B %-d, %Y" }}</p>
        {% if post.excerpt %}
        <p>{{ post.excerpt | strip_html }}</p>
        {% endif %}
    </li>
{% endfor %}
</ul>

{% if site.posts.size == 0 %}
<p>No posts yet. Check back soon!</p>
{% endif %}
