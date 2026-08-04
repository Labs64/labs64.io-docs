---
title: Changelog & Release Notes
nav_order: 6
has_children: false
has_toc: false
description: "Track Labs64.IO ecosystem additions, updates, and fixes."
---

# Changelog

We improve the Labs64.IO ecosystem every day by releasing new features, squashing bugs, and delivering fresh documentation. Here's an account of what's recently happened.

{% for change in site.data.changelog %}

---

<section markdown="1" title="{{ change.title }}">

### {{ change.title }}
<p style="font-size: smaller; font-style: italic;">{% if change.component %}In {{ change.component }} on {% endif %}{{ change.date | date: '%B %d, %Y' }}</p>
<p class="change-description">{{ change.description }}</p>

{% if change.image %}
<img src="{{ change.image }}" alt="{{ change.title }}">
{% endif %}

{% if change.features %}
**Changes:**
{% for feature in change.features %}
{% for item in feature %}
{% case item[0] %}
{% when 'added' %}
{% assign style = 'label-green' %}
{% when 'updated' %}
{% assign style = 'label-yellow' %}
{% when 'fixed' %}
{% assign style = 'label-red' %}
{% else %}
{% assign style = 'label-purple' %}
{% endcase %}
- <span class="label {{ style }}">{{ item[0] }}</span> {{ item[1] }}
{% endfor %}
{% endfor %}
{% endif %}

{% if change.url %}
[Learn more]({{ change.url }}){: .btn }
{% endif %}

</section>

{% endfor %}
