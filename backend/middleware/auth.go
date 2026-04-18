package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"google.golang.org/api/idtoken"
)

type AuthMiddleware struct {
	clientID      string
	allowedDomain string
}

func NewAuthMiddleware(clientID, allowedDomain string) *AuthMiddleware {
	return &AuthMiddleware{
		clientID:      clientID,
		allowedDomain: allowedDomain,
	}
}

func (a *AuthMiddleware) RequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip auth if no client ID configured (local dev without auth)
		if a.clientID == "" {
			c.Next()
			return
		}

		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "missing authorization header"})
			c.Abort()
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == authHeader {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid authorization header format"})
			c.Abort()
			return
		}

		payload, err := idtoken.Validate(context.Background(), tokenString, a.clientID)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			c.Abort()
			return
		}

		// Check domain if configured
		if a.allowedDomain != "" {
			email, ok := payload.Claims["email"].(string)
			if !ok {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "email not found in token"})
				c.Abort()
				return
			}

			if !strings.HasSuffix(email, "@"+a.allowedDomain) {
				c.JSON(http.StatusForbidden, gin.H{"error": "unauthorized domain"})
				c.Abort()
				return
			}
		}

		c.Set("email", payload.Claims["email"])
		c.Next()
	}
}
