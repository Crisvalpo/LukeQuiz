# LukeQuiz — Plan de publicación y formalización (Chile, julio 2026)

> Nota: esto es información orientativa recopilada para tu aprendizaje, no asesoría legal ni tributaria. Antes de decisiones con consecuencias (régimen tributario, contratos), valida con un contador — la primera consulta suele costar menos que un error en el F29.

## La idea general

Usar LukeQuiz como vehículo de aprendizaje de formalización es un plan sensato porque el negocio ya existe en miniatura: tienes producto, usuarios y un flujo de cobro (transferencia + WhatsApp + código). Formalizar es, en esencia, reemplazar cada pieza informal por su versión legal: la transferencia a tu CuentaRUT se convierte en pasarela de pago con boleta, tu nombre se convierte en una empresa, y el "confío en ti" se convierte en términos y condiciones. El plan va por etapas para que cada mes aprendas UNA cosa nueva sin ahogarte.

## Etapa 0 — Lo que puedes hacer YA sin trámites (semanas 1-2)

**Dominio propio.** Registra `lukequiz.cl` en NIC Chile: cuesta $9.940 + IVA al año (≈$11.829), con descuento si pagas varios años. Se registra como persona natural con tu RUT, sin necesidad de empresa. Apúntalo a tu Cloudflare actual y listo. Es el trámite más barato y de mayor impacto en seriedad percibida.

**Términos y Condiciones + Política de Privacidad.** Obligatorio antes de cobrar formalmente. Deben cubrir: qué datos guardas (email, nickname, historial de partidas), para qué, el derecho a eliminación, la moderación de contenido (ya la tienes — es un punto a favor), edad mínima o consentimiento parental para menores, y las condiciones del pase premium (qué incluye, duración, política de reembolso — el SERNAC exige claridad en esto).

**Precio con IVA en mente.** Tu pase vale $1.000. Cuando emitas boleta, el 19% de IVA sale DE ese precio (≈$159 son impuesto, te quedan $841 menos comisión de pasarela). Considera desde ya reestructurar: pase 24h $1.500, plan mensual $3.990, plan profesor anual. Los micropagos de $1.000 sufren con las comisiones mínimas de las pasarelas.

## Etapa 1 — Formalización tributaria mínima (mes 1-2)

Aquí decides entre dos caminos:

**Camino A: Persona natural con inicio de actividades** (recomendado para partir). En sii.cl con tu ClaveÚnica haces "Inicio de Actividades" de primera categoría con un giro como "servicios de plataformas tecnológicas" (código de actividad 620200 o 631100 aprox. — el SII te orienta). Gratis, 100% online, activo en 24-72 horas. Desde ahí puedes emitir **boleta electrónica de ventas** con el sistema gratuito del propio SII, y declaras IVA mensual en el **Formulario 29** (también online; si no vendiste, declaras "sin movimiento"). Aprendes el ciclo tributario completo con riesgo mínimo y sin costos fijos.

**Camino B: SpA por "Empresa en un Día"** (cuando valides ingresos). En registrodeempresasysociedades.cl creas una SpA **gratis** en 24-48 horas (solo necesitas ClaveÚnica; si no tienes firma electrónica avanzada, un notario firma por ~$10-25 mil). Luego: RUT e inicio de actividades de la empresa en el SII, cuenta bancaria empresa, y patente municipal en tu comuna (para servicios digitales desde casa suele ser patente comercial de bajo costo, varía por municipalidad). La ventaja: separa tu patrimonio personal del negocio y es el vehículo correcto si esto crece.

**Régimen tributario: ProPyme Transparente (art. 14 D N°8).** Para ambos caminos es el régimen natural: la empresa no paga impuesto de primera categoría — las utilidades tributan directo en tu global complementario personal, con contabilidad simplificada que el SII casi te hace solo (propuestas de declaración automáticas basadas en tus boletas electrónicas). Si tus ingresos personales totales son moderados, la tasa efectiva puede ser muy baja o cero.

**Mi recomendación de secuencia:** Camino A ahora para aprender el ciclo (boleta → F29 mensual → renta anual F22 en abril), y saltar a SpA cuando superes ~$300-500 mil/mes sostenidos o quieras postular a fondos (CORFO/Sercotec piden empresa constituida).

## Etapa 2 — Actualización del cobro premium en la app (mes 2-3)

El flujo actual (transferencia → comprobante por WhatsApp → tú generas código a mano) no escala y depende de que estés despierto. El plan técnico:

**Elección de pasarela.** Para tu ticket bajo y contexto: **Khipu** cobra 0,69% + IVA por transferencia instantánea (la más barata, ideal para tu público que ya paga por transferencia), **MercadoPago** ~2,89-3,19% sin costo fijo de integración y acepta persona natural con RUT, **Flow** 2,95% + IVA crédito / 0,99% transferencia, **Webpay (Transbank)** 2,95-3,5% + IVA y requiere más formalización. Estrategia razonable: partir con **MercadoPago o Khipu** (aceptan persona natural, integración simple) y agregar Webpay después si los clientes lo piden.

**Cambios en la app** (los puedo implementar cuando tengas la cuenta de pasarela):

1. Edge function `create-payment`: crea la orden de pago en la pasarela y devuelve la URL de checkout. El PremiumModal cambia el bloque de "datos bancarios + WhatsApp" por un botón "Pagar".
2. Edge function `payment-webhook`: la pasarela notifica el pago confirmado → valida la firma → activa `premium_until` del usuario directamente (la infraestructura segura ya existe desde la auditoría: SECURITY DEFINER, columnas premium protegidas). **Se elimina el código manual por completo** — el pase se activa solo, a las 3 AM de un domingo si hace falta.
3. Tabla `payments` (usuario, monto, pasarela, estado, fecha) — es además tu libro de ventas para el F29.
4. Los códigos promo actuales quedan como herramienta de regalo/marketing, ya no como flujo de venta.
5. Fase siguiente: **suscripción mensual** (MercadoPago y Flow soportan cobros recurrentes) y **boleta electrónica automática** por API (Haulmer/OpenFactura o LibreDTE emiten boletas SII por ~$0-10 mil/mes). Al inicio puedes emitir la boleta a mano en sii.cl con cada venta — con pocas ventas diarias es 1 minuto.

## Etapa 3 — Protección de datos: fecha límite real (antes del 1 dic 2026)

La **Ley 21.719** de protección de datos personales entra en plena vigencia el **1 de diciembre de 2026** — en cinco meses. Aplica a empresas de todos los tamaños; las PYME tienen un año de gracia (amonestación en vez de multa) pero las multas de régimen llegan a 20.000 UTM. Para LukeQuiz concretamente significa: mantener un **registro de actividades de tratamiento** (qué datos guardas, para qué, por cuánto tiempo — un documento simple en tu caso), base de licitud clara (consentimiento al registrarse), mecanismo real de **eliminación de cuenta y datos** (falta en la app — agregarlo), **notificación de filtraciones**, y cuidado especial con datos de menores (tu público incluye niños: minimiza — no pides edad ni datos extra, eso juega a favor). La auditoría de seguridad que hicimos (RLS, sin emails expuestos, moderación) te deja mejor parado que la mayoría.

## Qué estudiar (en orden)

1. **Ciclo tributario básico**: los cursos gratuitos de sii.cl ("Educación Tributaria") sobre boleta electrónica, F29 e IVA. Es lo primero porque lo usarás cada mes.
2. **Régimen ProPyme Transparente**: la página del SII sobre el art. 14 D N°8 — entender qué gastos puedes rebajar (hosting, dominio, APIs, parte de internet).
3. **Documentación de tu pasarela elegida** (webhooks, firma de notificaciones) — esto lo aprendes conmigo cuando integremos.
4. **Ley 21.719 en versión práctica**: cualquier guía para pymes; con entender registro de tratamiento + derechos ARCO-P es suficiente para tu escala.
5. **SERNAC / Ley Pro-consumidor**: reglas de reembolso y publicidad de precios (el precio SIEMPRE con IVA incluido de cara al consumidor).
6. Más adelante: **marca en INAPI** (registrar "LukeQuiz", ~$130-180 mil todo incluido, verificar tarifas vigentes) y postulación a **Sercotec/CORFO** (Semilla Inicia) donde una SpA formalizada con ventas demostrables corre con ventaja.

## Costos resumidos del arranque

Dominio .cl ≈ $12 mil/año. SpA por Empresa en un Día: $0 (+ notario ~$15 mil si no tienes FEA). Inicio de actividades y boleta electrónica SII: $0. Patente municipal: variable, típicamente $30-80 mil/año para microempresa. Pasarela: solo comisión por venta, sin costo fijo. Contador: opcional al inicio con ProPyme Transparente (el SII propone las declaraciones); presupuesta ~$30-60 mil/mes cuando haya movimiento real. Total para estar operando legal: **menos de $100 mil el primer año**, sin contar tu tiempo — que es justamente la inversión de aprendizaje que buscas.

## Cronograma sugerido (90 días)

Semanas 1-2: dominio .cl + redactar T&C y privacidad + decidir precios con IVA. Semanas 3-4: inicio de actividades persona natural en SII + primera boleta electrónica de prueba + cuenta en pasarela. Mes 2: integración de pago automático en la app (te acompaño en el código) + primer F29. Mes 3: evaluar volumen → decidir salto a SpA + preparar checklist Ley 21.719 (antes de diciembre) + explorar Sercotec.

## Fuentes

- [Tarifas dominio .CL — NIC Chile](https://www.nic.cl/dominios/tarifas.html)
- [Comparativa pasarelas de pago Chile 2026 — GuiaDeSoftware](https://www.guiadesoftware.com/blog/mejor-pasarela-pago-chile) · [ByteU comisiones](https://byteu.cl/comisiones-pasarelas-de-pago-online-en-chile/) · [Rebill comparativa](https://www.rebill.com/blog/pasarelas-pago-chile)
- [Ley 21.719 — Biblioteca del Congreso Nacional](https://www.bcn.cl/leychile/navegar?idNorma=1209272) · [Guía práctica Ley 21.719](https://preyproject.com/es/blog/ley-de-proteccion-de-datos-en-chile)
- [Registro de Empresas y Sociedades (Empresa en un Día)](https://www.registrodeempresasysociedades.cl/InicioActividadesSII.aspx) · [Inicio de actividades SII guía 2026](https://www.legalprisma.cl/inicio-de-actividades-en-el-sii/) · [Requisitos ProPyme — SII](https://www.sii.cl/preguntas_frecuentes/declaracion_renta/001_140_7530.htm)
