# Post recap LinkedIn (borrador, no publicado)

Un año construyendo agentes que trabajan solos. Recuento, por si estás decidiendo si meter IA en tu operación.

El caso que más me enseñó no es un demo. Es Sofi, la vendedora de una distribuidora de químicos de limpieza en Hidalgo. Sofi atiende WhatsApp: recibe el pedido, arma la cotización en PDF con precios validados contra el catálogo, avisa si el cliente entra en la ruta de reparto gratis, registra el lead en el CRM y pide el comprobante de pago. Más de 1,000 conversaciones desde mayo, 2,200 cotizaciones enviadas, y un humano que sólo entra cuando Sofi lo pide.

Para que Sofi exista tuve que resolver primero dónde corre. De ahí salió Easybits: cada agente en su propia microVM, se pausa, se reanuda y se audita, en pesos. Encima corren Ghosty, que vende tu catálogo en el chat; Formmy, que atiende en tu sitio y en WhatsApp; y Mailmask, que procesa correo en tu dominio.

Tres cosas que no salen en los tutoriales:
• El modelo casi nunca es el problema. El problema es qué pasa a las 3 de la mañana cuando se cae con una cotización a medias.
• Un agente que no puedes pausar y leer paso a paso no lo puedes poner frente a un cliente. Lo aprendí el día que uno mandó 58 cotizaciones idénticas en una noche.
• Casi nada de lo que una empresa quiere automatizar es conversación. Es cotizar, rutear, capturar, avisar. Eso necesita menos LLM del que la gente cree y más plomería.

Esas mismas piezas son las que integro en otras empresas. Entrego cada dos semanas y entreno al equipo que lo va a operar.

Si tienes un proceso que hoy hace una persona a mano y quieres verlo corriendo así, escríbeme: wa.me/527712412825
