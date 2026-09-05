package com.example.expensetracker.controller;

import com.example.expensetracker.dto.CategoryDto;
import com.example.expensetracker.dto.CategoryRequest;
import com.example.expensetracker.dto.ErrorResponse;
import com.example.expensetracker.mapper.CategoryMapper;
import com.example.expensetracker.model.Category;
import com.example.expensetracker.model.User;
import com.example.expensetracker.service.CategoryService;
import com.example.expensetracker.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@Tag(
    name        = "Categories",
    description = """
        Manages the two types of expense categories available in the system:

        **User categories** — created by a specific user and visible only to them.
        Use `POST /api/categories/user/{userId}` to create one and
        `GET /api/categories/user/{userId}` to list them.

        **Global categories** — system-seeded categories shared across all users
        (Food, Transport, Utilities, Entertainment, Health).
        Use `GET /api/categories/global` to list them.

        When creating an expense, the `categoryId` can reference either a user
        category or a global category owned by that user.

        All endpoints require a valid **JWT Bearer token**.
        """
)
@SecurityRequirement(name = "BearerAuth")
@RestController
@RequestMapping("/api/categories")
public class CategoryController {

    private static final Logger log = LoggerFactory.getLogger(CategoryController.class);

    private final CategoryService categoryService;
    private final UserService userService;
    private final com.example.expensetracker.security.UserSecurity userSecurity;

    public CategoryController(CategoryService categoryService, UserService userService,
                              com.example.expensetracker.security.UserSecurity userSecurity) {
        this.categoryService = categoryService;
        this.userService = userService;
        this.userSecurity = userSecurity;
    }

    // ─── POST /api/categories/user/{userId} ─────────────────────────────

    @Operation(
        summary = "Create user category",
        description = """
            Creates a new personal expense category scoped to the specified user.

            **Business rules:**
            - The `name` field must not be blank (validated by `@NotBlank`).
            - Category names are **unique per user** — attempting to create a duplicate
              name for the same user returns `400`.
            - Two different users may each have a category with the same name.
            - Personal categories are **not visible** to other users.

            **Use case:**
            Create custom categories that don't exist in the global list, for example
            "Petrol", "Gym Membership", or "Pet Food". These can then be referenced
            by `categoryId` when creating expenses.
            """
    )
    @RequestBody(required = true, content = @Content(
        mediaType = MediaType.APPLICATION_JSON_VALUE,
        schema = @Schema(implementation = CategoryRequest.class),
        examples = @ExampleObject(
            name = "category-create-request",
            summary = "New personal category",
            value = "{ \"name\": \"Petrol\" }"
        )
    ))
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Category created successfully",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = CategoryDto.class),
                examples = @ExampleObject(name = "category-create-201", summary = "Created category with generated ID",
                    value = "{ \"id\": 6, \"name\": \"Petrol\" }"
                ))
        ),
        @ApiResponse(responseCode = "400", description = "Name is blank or already exists for this user",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class),
                examples = @ExampleObject(name = "category-create-400",
                    value = "{ \"status\": 400, \"error\": \"Bad Request\", \"message\": \"Category 'Petrol' already exists for this user\", \"path\": \"/api/categories/user/1\" }"
                ))
        ),
        @ApiResponse(responseCode = "401", description = "JWT token missing or invalid",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class),
                examples = @ExampleObject(name = "category-create-401",
                    value = "{ \"status\": 401, \"error\": \"Unauthorized\", \"message\": \"JWT token is missing or invalid\", \"path\": \"/api/categories/user/1\" }"
                ))
        ),
        @ApiResponse(responseCode = "400", description = "User not found",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class),
                examples = @ExampleObject(name = "category-create-user-400",
                    value = "{ \"status\": 400, \"error\": \"Bad Request\", \"message\": \"User not found\", \"path\": \"/api/categories/user/99\" }"
                ))
        )
    })
    @PostMapping("/user/{userId}")
    public ResponseEntity<CategoryDto> createCategory(
            @Parameter(
                description = "ID of the user who will own this category. Obtained from `POST /api/auth/register` or `POST /api/auth/login`.",
                required = true, example = "1"
            )
            @PathVariable Long userId,
            @Valid @org.springframework.web.bind.annotation.RequestBody CategoryRequest request) {
        userSecurity.validateUserAccess(userId);
        log.info("Received request to create category for userId={}: name='{}'", userId, request.getName());
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        Category category = categoryService.createCategory(request.getName(), user);
        log.info("Category created successfully with id={} for userId={}", category.getId(), userId);
        return new ResponseEntity<>(CategoryMapper.toDto(category), HttpStatus.CREATED);
    }

    // ─── GET /api/categories/user/{userId} ──────────────────────────────

    @Operation(
        summary = "Get user categories",
        description = """
            Returns all personal expense categories created by the specified user.

            **What is included:**
            Only categories explicitly created by this user via
            `POST /api/categories/user/{userId}`. Global (system-seeded) categories
            are **excluded** from this response.

            **What is not included:**
            - Global categories shared across all users (see `GET /api/categories/global`).
            - Categories created by other users.

            **Empty list:**
            A new user who has not yet created any personal categories will receive
            an empty JSON array `[]`. This is a valid, non-error response.

            **Ordering:**
            Categories are returned in insertion order (no explicit sort applied).
            """
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "List of personal categories (empty array if none created yet)",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                array = @ArraySchema(schema = @Schema(implementation = CategoryDto.class)),
                examples = @ExampleObject(name = "category-user-list-200", summary = "Two personal categories",
                    value = "[ { \"id\": 6, \"name\": \"Petrol\" }, { \"id\": 7, \"name\": \"Gym Membership\" } ]"
                ))
        ),
        @ApiResponse(responseCode = "400", description = "User not found",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class),
                examples = @ExampleObject(name = "category-user-list-400",
                    value = "{ \"status\": 400, \"error\": \"Bad Request\", \"message\": \"User not found\", \"path\": \"/api/categories/user/99\" }"
                ))
        ),
        @ApiResponse(responseCode = "401", description = "JWT token missing or invalid",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class),
                examples = @ExampleObject(name = "category-user-list-401",
                    value = "{ \"status\": 401, \"error\": \"Unauthorized\", \"message\": \"JWT token is missing or invalid\", \"path\": \"/api/categories/user/1\" }"
                ))
        )
    })
    @GetMapping("/user/{userId}")
    public ResponseEntity<List<CategoryDto>> getUserCategories(
            @Parameter(description = "ID of the user whose personal categories to retrieve.", required = true, example = "1")
            @PathVariable Long userId) {
        userSecurity.validateUserAccess(userId);
        log.debug("Fetching user categories for userId={}", userId);
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        List<CategoryDto> categories = categoryService.getUserCategories(user)
                .stream().map(CategoryMapper::toDto).collect(Collectors.toList());
        log.info("Retrieved {} user categories for userId={}", categories.size(), userId);
        return ResponseEntity.ok(categories);
    }

    // ─── GET /api/categories/global ─────────────────────────────────────

    @Operation(
        summary = "Get global categories",
        description = """
            Returns all system-wide expense categories shared across every user account.

            **Pre-seeded categories** (inserted by `data.sql` at startup):

            | ID | Name           |
            |----|----------------|
            | 1  | Food           |
            | 2  | Transport      |
            | 3  | Utilities      |
            | 4  | Entertainment  |
            | 5  | Health         |

            **These categories:**
            - Are not owned by any user (`user_id = NULL` in the database).
            - Cannot be created, edited, or deleted via the API.
            - Are available to all users as `categoryId` values when creating expenses.
            - Are returned in addition to a user's personal categories when selecting
              a category for an expense.

            Any authenticated user can call this endpoint regardless of their own category setup.
            """
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Full list of global system categories",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                array = @ArraySchema(schema = @Schema(implementation = CategoryDto.class)),
                examples = @ExampleObject(name = "category-global-list-200", summary = "All 5 seeded global categories",
                    value = "[ { \"id\": 1, \"name\": \"Food\" }, { \"id\": 2, \"name\": \"Transport\" }, { \"id\": 3, \"name\": \"Utilities\" }, { \"id\": 4, \"name\": \"Entertainment\" }, { \"id\": 5, \"name\": \"Health\" } ]"
                ))
        ),
        @ApiResponse(responseCode = "401", description = "JWT token missing or invalid",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class),
                examples = @ExampleObject(name = "category-global-list-401",
                    value = "{ \"status\": 401, \"error\": \"Unauthorized\", \"message\": \"JWT token is missing or invalid\", \"path\": \"/api/categories/global\" }"
                ))
        )
    })
    @GetMapping("/global")
    public ResponseEntity<List<CategoryDto>> getGlobalCategories() {
        log.debug("Fetching global categories");
        List<CategoryDto> categories = categoryService.getGlobalCategories()
                .stream().map(CategoryMapper::toDto).collect(Collectors.toList());
        log.info("Retrieved {} global categories", categories.size());
        return ResponseEntity.ok(categories);
    }

    @Operation(
        summary = "Delete user category",
        description = """
            Deletes a personal category owned by the specified user.

            **Business rules:**
            - Global (system-seeded) categories can never be deleted.
            - A category still referenced by any expense or recurring
              subscription cannot be deleted — returns `409 Conflict`.
            - Only the owning user may delete their own category.
            """
    )
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Category deleted successfully"),
        @ApiResponse(responseCode = "400", description = "Category not found, not owned by this user, or is a global category"),
        @ApiResponse(responseCode = "409", description = "Category is still in use by one or more expenses")
    })
    @DeleteMapping("/{categoryId}/user/{userId}")
    public ResponseEntity<Void> deleteCategory(
            @Parameter(description = "ID of the category to delete", required = true, example = "6")
            @PathVariable Long categoryId,
            @Parameter(description = "ID of the user who owns the category", required = true, example = "1")
            @PathVariable Long userId) {
        userSecurity.validateUserAccess(userId);
        log.info("Received request to delete category id={} for userId={}", categoryId, userId);
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        categoryService.deleteCategory(categoryId, user);
        log.info("Category id={} deleted successfully for userId={}", categoryId, userId);
        return ResponseEntity.noContent().build();
    }
}
