package com.platform.chatservice.service;

import com.platform.chatservice.config.RabbitMqConfig;
import io.micrometer.tracing.Span;
import io.micrometer.tracing.TraceContext;
import io.micrometer.tracing.Tracer;
import io.micrometer.tracing.propagation.Propagator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.core.MessagePostProcessor;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Verifies the RabbitMQ inject side of the end-to-end trace: the publisher must
 * (a) start an ai.request.publish span, (b) run the MessagePostProcessor that injects
 * the W3C traceparent into the AMQP message headers, and (c) close the scope then end
 * the span.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AiRedisPublisherTest {

    @Mock private RabbitTemplate rabbitTemplate;
    @Mock private Tracer tracer;
    @Mock private Propagator propagator;
    @Mock private Span span;
    @Mock private Tracer.SpanInScope spanInScope;
    @Mock private TraceContext traceContext;

    private AiRedisPublisher publisher;

    @BeforeEach
    void setUp() {
        when(tracer.nextSpan()).thenReturn(span);
        when(span.name(anyString())).thenReturn(span);
        when(span.start()).thenReturn(span);
        when(span.context()).thenReturn(traceContext);
        when(traceContext.traceId()).thenReturn("4bf92f3577b34da6a3ce929d0e0e4736");
        when(tracer.withSpan(any(Span.class))).thenReturn(spanInScope);

        publisher = new AiRedisPublisher(rabbitTemplate, tracer, propagator);
    }

    @Test
    void publishAiRequest_injectsTraceparentIntoAmqpHeadersAndEndsSpan() {
        // Make the propagator inject a "traceparent" header when invoked.
        doAnswer(inv -> {
            MessageProperties props = inv.getArgument(1);
            Propagator.Setter<MessageProperties> setter = inv.getArgument(2);
            setter.set(props, "traceparent", "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01");
            return null;
        }).when(propagator).inject(eq(traceContext), any(MessageProperties.class), any());

        publisher.publishAiRequest("conv-1", "user-1", "Alice", "@AI hello", List.of());

        // Capture the MessagePostProcessor passed to convertAndSend and run it against a real Message.
        ArgumentCaptor<MessagePostProcessor> captor = ArgumentCaptor.forClass(MessagePostProcessor.class);
        verify(rabbitTemplate).convertAndSend(
            eq(RabbitMqConfig.AI_EXCHANGE), eq(RabbitMqConfig.AI_ROUTING_KEY), any(Object.class), captor.capture());

        Message msg = new Message("body".getBytes(), new MessageProperties());
        Message processed = captor.getValue().postProcessMessage(msg);

        // The lowercase "traceparent" header (W3C, what ai-service reads) must be present.
        Object header = processed.getMessageProperties().getHeaders().get("traceparent");
        assertThat(header).isEqualTo("00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01");

        verify(propagator).inject(eq(traceContext), any(MessageProperties.class), any());
        verify(spanInScope).close();
        verify(span).end();
    }
}
