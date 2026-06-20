package com.platform.chatservice.config;

import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitAdmin;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMqConfig {

  public static final String AI_EXCHANGE = "ai.direct";
  public static final String AI_QUEUE = "ai.requests";
  public static final String AI_ROUTING_KEY = "ai.request";
  public static final String DLX_EXCHANGE = "ai.dead-letter";
  public static final String DLQ = "ai.requests.dlq";

  @Bean
  DirectExchange aiExchange() {
    return new DirectExchange(AI_EXCHANGE, true, false);
  }

  @Bean
  DirectExchange deadLetterExchange() {
    return new DirectExchange(DLX_EXCHANGE, true, false);
  }

  @Bean
  Queue aiQueue() {
    return QueueBuilder.durable(AI_QUEUE)
        .withArgument("x-dead-letter-exchange", DLX_EXCHANGE)
        .withArgument("x-dead-letter-routing-key", "dlq")
        .withArgument("x-message-ttl", 30_000)
        .build();
  }

  @Bean
  Queue deadLetterQueue() {
    return QueueBuilder.durable(DLQ).build();
  }

  @Bean
  Binding aiBinding(Queue aiQueue, DirectExchange aiExchange) {
    return BindingBuilder.bind(aiQueue).to(aiExchange).with(AI_ROUTING_KEY);
  }

  @Bean
  Binding dlqBinding(Queue deadLetterQueue, DirectExchange deadLetterExchange) {
    return BindingBuilder.bind(deadLetterQueue).to(deadLetterExchange).with("dlq");
  }

  @Bean
  Jackson2JsonMessageConverter messageConverter() {
    return new Jackson2JsonMessageConverter();
  }

  @Bean
  RabbitTemplate rabbitTemplate(
      ConnectionFactory connectionFactory, Jackson2JsonMessageConverter messageConverter) {
    RabbitTemplate template = new RabbitTemplate(connectionFactory);
    template.setMessageConverter(messageConverter);
    return template;
  }

  // Override Spring Boot's auto-configured RabbitAdmin so that a transient RabbitMQ
  // connection failure at startup does not crash the Spring context before Tomcat binds
  // to port 8080. Spring AMQP retries declarations automatically once the connection
  // recovers, so topology is still declared — just not blocking the health-check path.
  @Bean
  RabbitAdmin rabbitAdmin(ConnectionFactory connectionFactory) {
    RabbitAdmin admin = new RabbitAdmin(connectionFactory);
    admin.setIgnoreDeclarationExceptions(true);
    return admin;
  }
}
