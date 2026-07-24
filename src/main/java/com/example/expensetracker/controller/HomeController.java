package com.example.expensetracker.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Controller to redirect requests from root to the Swagger UI.
 * This prevents the browser from prompting for Basic Authentication
 * when visiting the root endpoint (e.g. on Hugging Face Spaces).
 */
@Controller
public class HomeController {

    @GetMapping("/")
    public String index() {
        return "redirect:/swagger-ui.html";
    }
}
