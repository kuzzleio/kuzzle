---
code: false
type: page
title: Introduction
description: How to develop your custom application using Kuzzle
order: 0
---

# Introduction

Kuzzle propose de nombreuses fonctionnalités prêtes à l'emploi.  
Cependant la plupart du temps vous aurez besoin de développer vos propres fonctionnalités adaptées à votre métier.

Une API est disponible pour permettre aux développeurs d'étendre les fonctionnalités de Kuzzle en créant une application.  

[Voir les Key Concepts]

## Controllers

Les contrôleurs permettent de déclarer de nouvelles actions d'API.  

Ces actions sont simplement des fonctions recevant une requête en paramètre et retournant un résultat.

Les actions d'API ainsi déclarées sont disponibles via les protocols actuellement activés (Http, WebSocket, MQTT, etc.)

[Consulter la documentation des Controlers]

## Internal Events

Dans Kuzzle, chaque action génère un évènement auquel il est possible de réagir.

Ces actions peuvent être la réception d'une requête, le début de l'exécution d'une action d'API, une erreur, etc.  

[Consulter la liste des évènements]

Les Pipes et les Hooks sont les deux manières d'intéragir avec ces évènements.

### Pipes

Les pipes sur les évènements permettent de modifier le flux d'exécution d'une requête.

Concrètement les pipes sont simplement des fonctions recevant en paramètre une requête ou un autre type de payload et devant le retourner afin que Kuzzle poursuive le cycle d'exécution.

Si un pipe lèvent une exception alors le cycle d'exécution sera interrompu et la requête sera retournée avec l'erreur correspondante.

L'enrichissement de données avant stockage ou une gestion plus fine des droits utilisateur sont de bons exemples d'utilisation de pipes.

[Consulter la documentation des pipes]

### Hooks

Les hooks sur les évènements permettent de réagir à l'exécution d'une requête.

Tout comme les pipes, les hooks sont des fonctions recevant en paramètre une requête ou un autre type de payload.

Leur exécution se fait en parallèle du cycle d'exécution de la requête. Les hooks ne peuvent donc pas intervenir sur le cycle d'exécution.

Les hooks peuvent être utilisés pour l'exécution de tâches pouvant ralentir le temps de réponse de la requête sans qu'elles soient nécessaires à son exécution.

L'envoi d'emails ou de notifications vers un service externes sont de bons exemples d'utilisation de hooks.

[Consulter la documentation des hooks]

## Plugins

Les plugins sont des modules Node.js apportant de nouvelles fonctionnalités à votre application.

Ils peuvent être distribué via NPM mais ils sont aussi installable depuis le filesystem.

Les plugins offrent sensiblement les mêmes possibilités d'extension des fonctionnalités de Kuzzle qu'une application sauf qu'ils sont généralement pensés pour être réutilisables entre plusieurs projets.

[Consulter la documentation des plugins]