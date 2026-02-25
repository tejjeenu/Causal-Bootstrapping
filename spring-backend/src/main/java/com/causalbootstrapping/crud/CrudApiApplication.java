package com.causalbootstrapping.crud;

import com.causalbootstrapping.crud.config.ApplicationProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(ApplicationProperties.class)
public class CrudApiApplication {
    public static void main(String[] args) {
        SpringApplication.run(CrudApiApplication.class, args);
    }
}
