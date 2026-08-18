package com.example.expensetracker.cucumber.steps;

import com.example.expensetracker.cucumber.context.ScenarioContext;
import io.cucumber.java.en.And;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.When;
import io.restassured.http.ContentType;
import io.restassured.response.Response;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Step definitions for {@code categories.feature}.
 *
 * <p>Covers creation and retrieval of user-specific categories and global system categories.</p>
 */
public class CategorySteps {

    @Autowired
    private ScenarioContext ctx;

    // ─── Given — seed category ────────────────────────────────────────────

    @Given("I have created a category named {string}")
    public void iHaveCreatedACategory(String name) {
        Map<String, String> body = new HashMap<>();
        body.put("name", name);

        Response r = ctx.request()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + ctx.getAuthToken())
                .body(body)
                .when()
                .post("/api/categories/user/" + ctx.getUserId());

        assertThat(r.statusCode()).as("Seed category creation failed for name: " + name).isEqualTo(201);
        ctx.setCategoryId(r.jsonPath().getLong("id"));
    }

    // ─── Create category steps ────────────────────────────────────────────

    @When("I create a category named {string}")
    public void iCreateACategory(String name) {
        Map<String, String> body = new HashMap<>();
        body.put("name", name);

        Response r = ctx.request()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + ctx.getAuthToken())
                .body(body)
                .when()
                .post("/api/categories/user/" + ctx.getUserId());

        ctx.setLastResponse(r);
        if (r.statusCode() == 201) {
            ctx.setCategoryId(r.jsonPath().getLong("id"));
        }
    }

    @When("I create a category with a blank name")
    public void iCreateCategoryWithBlankName() {
        Map<String, String> body = new HashMap<>();
        body.put("name", "");

        ctx.setLastResponse(
                ctx.request()
                        .contentType(ContentType.JSON)
                        .header("Authorization", "Bearer " + ctx.getAuthToken())
                        .body(body)
                        .when()
                        .post("/api/categories/user/" + ctx.getUserId())
        );
    }

    @When("I create a category named {string} for user id {long}")
    public void iCreateCategoryForUserId(String name, long userId) {
        Map<String, String> body = new HashMap<>();
        body.put("name", name);

        ctx.setLastResponse(
                ctx.request()
                        .contentType(ContentType.JSON)
                        .header("Authorization", "Bearer " + ctx.getAuthToken())
                        .body(body)
                        .when()
                        .post("/api/categories/user/" + userId)
        );
    }

    // ─── Get user categories steps ────────────────────────────────────────

    @When("I get all categories for my user")
    public void iGetAllCategoriesForMyUser() {
        ctx.setLastResponse(
                ctx.request()
                        .header("Authorization", "Bearer " + ctx.getAuthToken())
                        .when()
                        .get("/api/categories/user/" + ctx.getUserId())
        );
    }

    @When("I get categories for user id {long}")
    public void iGetCategoriesForUserId(long userId) {
        ctx.setLastResponse(
                ctx.request()
                        .header("Authorization", "Bearer " + ctx.getAuthToken())
                        .when()
                        .get("/api/categories/user/" + userId)
        );
    }

    // ─── Get global categories steps ──────────────────────────────────────

    @When("I get all global categories")
    public void iGetAllGlobalCategories() {
        ctx.setLastResponse(
                ctx.request()
                        .header("Authorization", "Bearer " + ctx.getAuthToken())
                        .when()
                        .get("/api/categories/global")
        );
    }

    // ─── Assertion steps ──────────────────────────────────────────────────

    @And("the response should contain a category id")
    public void theResponseShouldContainCategoryId() {
        Object id = ctx.getLastResponse().jsonPath().get("id");
        assertThat(id).as("Response should contain a category 'id'").isNotNull();
    }

    @And("the response should contain at least {int} categories")
    public void theResponseShouldContainAtLeastNCategories(int minCount) {
        List<?> list = ctx.getLastResponse().jsonPath().getList("$");
        assertThat(list)
                .as("Expected at least %d categories in response", minCount)
                .hasSizeGreaterThanOrEqualTo(minCount);
    }

    @And("the category list should include {string}")
    public void theCategoryListShouldInclude(String categoryName) {
        List<String> names = ctx.getLastResponse().jsonPath().getList("name");
        assertThat(names)
                .as("Category list should contain '%s'", categoryName)
                .contains(categoryName);
    }

    @And("the global category list should include {string}")
    public void theGlobalCategoryListShouldInclude(String categoryName) {
        List<String> names = ctx.getLastResponse().jsonPath().getList("name");
        assertThat(names)
                .as("Global category list should contain '%s'", categoryName)
                .contains(categoryName);
    }

    // ─── Delete category steps ────────────────────────────────────────────
    // These guard the category-deletion feature built this session: a
    // category can only be removed if nothing references it, and global
    // (system-seeded) categories can never be removed at all.

    @When("I delete the category I just created")
    public void iDeleteTheCategoryIJustCreated() {
        ctx.setLastResponse(
                ctx.request()
                        .header("Authorization", "Bearer " + ctx.getAuthToken())
                        .when()
                        .delete("/api/categories/" + ctx.getCategoryId() + "/user/" + ctx.getUserId())
        );
    }

    @When("I delete global category {string}")
    public void iDeleteGlobalCategory(String categoryName) {
        // Look up the global category's real ID by name first, since it's
        // system-seeded rather than created by this scenario.
        Response globals = ctx.request()
                .header("Authorization", "Bearer " + ctx.getAuthToken())
                .when()
                .get("/api/categories/global");

        Long globalId = null;
        List<Map<String, Object>> list = globals.jsonPath().getList("$");
        for (Map<String, Object> cat : list) {
            if (categoryName.equals(cat.get("name"))) {
                globalId = Long.valueOf(cat.get("id").toString());
                break;
            }
        }
        assertThat(globalId).as("Global category '%s' should exist to attempt deleting it", categoryName).isNotNull();

        ctx.setLastResponse(
                ctx.request()
                        .header("Authorization", "Bearer " + ctx.getAuthToken())
                        .when()
                        .delete("/api/categories/" + globalId + "/user/" + ctx.getUserId())
        );
    }

    @And("the category I created should no longer exist for my user")
    public void theCategoryShouldNoLongerExist() {
        Response r = ctx.request()
                .header("Authorization", "Bearer " + ctx.getAuthToken())
                .when()
                .get("/api/categories/user/" + ctx.getUserId());

        List<Long> ids = r.jsonPath().getList("id", Long.class);
        assertThat(ids)
                .as("Deleted category id %d should no longer appear in the user's category list", ctx.getCategoryId())
                .doesNotContain(ctx.getCategoryId());
    }
}
